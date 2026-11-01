/**
 * The book of business: one place that holds subscriptions, invoices, credit
 * notes, payments and account credit, and keeps them consistent as operations
 * happen one after another.
 */

import { compareDates } from './core/dates.mjs';
import { createCustomerRegistry, isReverseCharge } from './customers/registry.mjs';
import { UnknownRecordError } from './core/validate.mjs';
import { createSequence } from './core/sequence.mjs';
import { buildInvoice } from './invoicing/invoice.mjs';
import { createAccountLedger } from './ledger/account.mjs';
import { createSettlement, invoiceBalance } from './ledger/balances.mjs';
import {
  creditInvoiceInFull,
  creditedToDate,
  issueCreditNote,
  remainingCreditable,
} from './ledger/credit-notes.mjs';
import { agingReport, dunningQueue } from './ledger/dunning.mjs';
import { buildJournal, entryImbalance, trialBalance } from './ledger/journal.mjs';
import { refundQueue, settleCreditNote } from './ledger/settlement.mjs';
import { bookSnapshot, creditNotesCsv, invoicesCsv, journalCsv, revenueCsv } from './reporting/export.mjs';
import { customerSummary, renderAccountStatement } from './reporting/customer.mjs';
import {
  monthlyChurnBps,
  monthlyRecurringRevenue,
  renewalForecast,
  subscriberMovement,
  subscribersByPlan,
} from './reporting/forecast.mjs';
import { deferredRevenue, revenueByMonth } from './reporting/revenue.mjs';
import { renderStatement } from './reporting/statement.mjs';
import { taxReport } from './reporting/tax-report.mjs';
import { applyPlanChange, draftCancellation, draftPlanChange, endRecord } from './subscriptions/plan-change.mjs';
import { createRecord } from './subscriptions/record.mjs';
import { draftPeriodInvoice, enterPeriod, firstPeriod, nextPeriod } from './subscriptions/renewal.mjs';
import {
  applyScheduled,
  clearScheduled,
  isCancelling,
  scheduleChange,
} from './subscriptions/scheduled-changes.mjs';
import { createTimeline, describeEvents } from './subscriptions/timeline.mjs';
import { rateOn } from './tax/rates.mjs';

/**
 * @param {object} options
 * @param {object} options.catalog from createCatalog
 * @param {object} [options.taxTable] from defineTaxTable; without one, nothing is taxed
 * @param {string} [options.sellerRegion] where the seller is registered, for reverse charge
 */
export function createBook({ catalog, taxTable = null, sellerRegion = null }) {
  const subscriptions = new Map();
  const invoices = new Map();
  const notes = [];
  const settlements = [];
  const account = createAccountLedger();
  const customers = createCustomerRegistry();
  const refundsPaidOut = [];
  const timeline = createTimeline();
  const invoiceNumbers = createSequence('INV');
  const noteNumbers = createSequence('CN');

  function requireSubscription(id) {
    const record = subscriptions.get(id);
    if (!record) throw new UnknownRecordError('subscription', id);
    return record;
  }

  function requireInvoice(number) {
    const invoice = invoices.get(number);
    if (!invoice) throw new UnknownRecordError('invoice', number);
    return invoice;
  }

  function taxRate(record, date) {
    if (!record.region || !taxTable) return 0;
    if (isReverseCharge(customers.find(record.customerId), record.region, sellerRegion)) return 0;
    return rateOn(taxTable, record.region, date);
  }

  function notesOn(number) {
    return notes.filter((note) => note.invoiceNumber === number);
  }

  function settlementsOn(number) {
    return settlements.filter((settlement) => settlement.invoiceNumber === number);
  }

  /** Everything already given back on an invoice's lines. */
  function drawnAgainst(number) {
    return notesOn(number);
  }

  function balanceOf(invoice) {
    return invoiceBalance(invoice, notesOn(invoice.number), settlementsOn(invoice.number));
  }

  function reversedNetOnSegment(segment) {
    const origin = requireInvoice(segment.invoiceNumber);
    return creditedToDate(origin, drawnAgainst(segment.invoiceNumber))[segment.lineIndex].net;
  }

  /** Finishes an invoice and moves account credit as it says. */
  function issue(input) {
    const { customerId, currency } = input;
    const invoice = buildInvoice({ ...input, accountCredit: account.balance(customerId, currency) });
    invoices.set(invoice.number, invoice);
    const details = { date: invoice.issueDate, reference: invoice.number };
    if (invoice.creditApplied > 0) account.take(customerId, currency, invoice.creditApplied, details);
    if (invoice.total < 0) account.add(customerId, currency, -invoice.total, details);
    return invoice;
  }

  function subscribe(request) {
    const { planCode, couponCode, discount, ...rest } = request;
    if (subscriptions.has(rest.id)) throw new RangeError(`Subscription ${rest.id} already exists`);
    const coupon = couponCode ? catalog.coupon(couponCode) : null;
    const record = createRecord({ ...rest, plan: catalog.plan(planCode), coupon });
    const period = firstPeriod(record);
    const invoice = issue(
      draftPeriodInvoice(record, period, {
        number: invoiceNumbers.take(),
        taxRateBps: taxRate(record, period.start),
        discount,
      }),
    );
    subscriptions.set(record.id, enterPeriod(record, period, invoice));
    timeline.record(record.id, 'subscribed', period.start, { invoiceNumber: invoice.number });
    return invoice;
  }

  /**
   * Moves a subscription into its next period. Returns the renewal invoice, or
   * null if the subscription was set to end instead.
   */
  function renew(id, options = {}) {
    const record = requireSubscription(id);
    if (record.status !== 'active') throw new RangeError(`Subscription ${id} has ended`);
    const period = nextPeriod(record);
    if (isCancelling(record)) {
      subscriptions.set(id, endRecord(record, period.start));
      timeline.record(id, 'ended', period.start);
      return null;
    }
    const terms = applyScheduled(record);
    const invoice = issue(
      draftPeriodInvoice(terms, period, {
        number: invoiceNumbers.take(),
        taxRateBps: taxRate(terms, period.start),
        discount: options.discount,
      }),
    );
    subscriptions.set(id, enterPeriod(terms, period, invoice));
    timeline.record(id, 'renewed', period.start, { invoiceNumber: invoice.number });
    return invoice;
  }

  function resolveChange(request) {
    const { date, planCode, seats } = request;
    return { date, seats, plan: planCode ? catalog.plan(planCode) : undefined };
  }

  /** Changes plan or seats today. Returns the invoice for the change. */
  function changePlan(id, request) {
    const record = requireSubscription(id);
    const change = resolveChange(request);
    const invoice = issue(
      draftPlanChange(record, change, {
        number: invoiceNumbers.take(),
        taxRateBps: taxRate(record, change.date),
        reversedNet: reversedNetOnSegment(record.segment),
      }),
    );
    subscriptions.set(id, applyPlanChange(record, change, invoice));
    timeline.record(id, 'changed', change.date, { invoiceNumber: invoice.number });
    return invoice;
  }

  /** What a change would come to, without doing it. */
  function previewChange(id, request) {
    const record = requireSubscription(id);
    const change = resolveChange(request);
    return buildInvoice({
      ...draftPlanChange(record, change, {
        number: 'PREVIEW',
        taxRateBps: taxRate(record, change.date),
        reversedNet: reversedNetOnSegment(record.segment),
      }),
      accountCredit: account.balance(record.customerId, record.currency),
    });
  }

  /** Sets new terms to take effect at the next renewal. */
  function scheduleForRenewal(id, request) {
    const record = requireSubscription(id);
    const { planCode, seats } = request;
    const plan = planCode ? catalog.plan(planCode) : undefined;
    subscriptions.set(id, scheduleChange(record, { plan, seats }));
    timeline.record(id, 'change-scheduled', record.period.start);
  }

  function clearSchedule(id) {
    const record = requireSubscription(id);
    subscriptions.set(id, clearScheduled(record));
    timeline.record(id, 'schedule-cleared', record.period.start);
  }

  /**
   * Cancels a subscription, either straight away (mode 'immediate'), giving back
   * the unused time, or when the current period ends (mode 'period-end').
   * Returns the invoice for the unused time, if there is one.
   */
  function cancel(id, { date, mode = 'immediate' }) {
    const record = requireSubscription(id);
    if (record.status !== 'active') throw new RangeError(`Subscription ${id} has ended`);
    if (mode === 'period-end') {
      subscriptions.set(id, scheduleChange(record, { cancel: true }));
      timeline.record(id, 'cancelled', date);
      return null;
    }
    if (mode !== 'immediate') throw new RangeError(`Unknown cancellation mode: ${mode}`);

    const input = draftCancellation(record, date, {
      number: invoiceNumbers.peek(),
      taxRateBps: taxRate(record, date),
      reversedNet: reversedNetOnSegment(record.segment),
    });
    const invoice = input ? issue({ ...input, number: invoiceNumbers.take() }) : null;
    subscriptions.set(id, endRecord(record, date));
    timeline.record(id, 'cancelled', date, invoice ? { invoiceNumber: invoice.number } : {});
    return invoice;
  }

  /**
   * Issues a credit note. Pass `lines` to credit part of an invoice, or leave it
   * out to credit everything still creditable.
   */
  function creditInvoice(number, request) {
    const invoice = requireInvoice(number);
    const { date, reason, lines } = request;
    const prior = drawnAgainst(number);
    const noteRequest = { number: noteNumbers.peek(), date, reason, lines };
    const draft = lines
      ? issueCreditNote(invoice, noteRequest, prior)
      : creditInvoiceInFull(invoice, noteRequest, prior);
    noteNumbers.take();

    const settlement = settleCreditNote(draft.total, {
      openBalance: balanceOf(invoice),
    });
    const note = { ...draft, settlement };
    notes.push(note);
    if (settlement.toAccount > 0) {
      account.add(invoice.customerId, invoice.currency, settlement.toAccount, {
        date,
        reference: note.number,
      });
    }
    return note;
  }

  /** Puts goodwill credit on a customer's account. */
  function grantAccountCredit(customerId, currency, { amount, date, reason = 'goodwill' }) {
    account.add(customerId, currency, amount, { date, reference: reason });
  }

  function settle(number, kind, { amount, date }) {
    const invoice = requireInvoice(number);
    const settlement = createSettlement(invoice, kind, amount, date);
    if (compareDates(date, invoice.issueDate) < 0) {
      throw new RangeError(`${kind} on ${number} predates the invoice`);
    }
    if (amount > balanceOf(invoice)) {
      throw new RangeError(`${number} has less than ${amount} open`);
    }
    settlements.push(settlement);
    return settlement;
  }

  /**
   * Renews every active subscription whose current period has ended by `asOf`,
   * as many times as it takes to catch up. Returns the invoices in order.
   */
  function runRenewals(asOf) {
    const issued = [];
    for (const id of subscriptions.keys()) {
      let record = subscriptions.get(id);
      while (record.status === 'active' && compareDates(record.period.end, asOf) <= 0) {
        const invoice = renew(id);
        if (invoice) issued.push(invoice);
        record = subscriptions.get(id);
      }
    }
    return issued;
  }

  function allInvoices() {
    return [...invoices.values()];
  }

  function journal() {
    return buildJournal({ invoices: allInvoices(), notes, settlements });
  }

  return {
    customers,
    subscribe,
    renew,
    runRenewals,
    changePlan,
    previewChange,
    scheduleForRenewal,
    clearSchedule,
    cancel,
    creditInvoice,
    grantAccountCredit,
    pay: (number, payment) => settle(number, 'payment', payment),
    writeOff: (number, entry) => settle(number, 'write-off', entry),

    subscription: requireSubscription,
    invoice: requireInvoice,
    invoices: allInvoices,
    notes: () => [...notes],
    notesOn,
    settlementsOn,
    balanceOf: (number) => balanceOf(requireInvoice(number)),
    remainingCreditable: (number) => remainingCreditable(requireInvoice(number), drawnAgainst(number)),
    accountCredit: (customerId, currency) => account.balance(customerId, currency),
    timeline: (id) => describeEvents(timeline.of(id)),

    statement(number) {
      return renderStatement(requireInvoice(number), notesOn(number), settlementsOn(number));
    },
    accountStatement(customerId, currency) {
      return renderAccountStatement(customerId, currency, account.entries(customerId, currency));
    },
    revenueByMonth: (currency) => revenueByMonth({ invoices: allInvoices(), notes, currency }),
    taxReport: (currency, month) => taxReport({ invoices: allInvoices(), notes, currency, month }),
    aging(currency, asOf, termsDays) {
      return agingReport({ invoices: allInvoices(), balanceOf, asOf, currency, termsDays });
    },
    dunning: (asOf, termsDays) => dunningQueue(allInvoices(), balanceOf, asOf, termsDays),
    customerSummary(customerId, currency) {
      return customerSummary({
        customerId,
        currency,
        invoices: allInvoices(),
        notes,
        settlements,
        account,
        balanceOf,
      });
    },
    monthlyRecurringRevenue: (currency) =>
      monthlyRecurringRevenue([...subscriptions.values()], currency),
    renewalForecast: (currency) => renewalForecast([...subscriptions.values()], currency),
    subscriberMovement: (month) => subscriberMovement([...subscriptions.values()], month),
    churn: (month) => monthlyChurnBps([...subscriptions.values()], month),
    subscribersByPlan: () => subscribersByPlan([...subscriptions.values()]),
    deferredRevenue: (currency, asOf) => deferredRevenue({ invoices: allInvoices(), currency, asOf }),
    revenueCsv: (currency) =>
      revenueCsv(revenueByMonth({ invoices: allInvoices(), notes, currency }), currency),
    journalCsv: () => journalCsv(journal()),
    refundsToPay: () => refundQueue(notes, refundsPaidOut),
    markRefundPaid(noteNumber) {
      refundsPaidOut.push(noteNumber);
    },
    journal,
    unbalancedJournalEntries: () => journal().filter((entry) => entryImbalance(entry) !== 0),
    trialBalance: () => trialBalance(journal()),
    snapshot: (takenOn) =>
      bookSnapshot({
        subscriptions: [...subscriptions.values()],
        invoices: allInvoices(),
        notes,
        settlements,
        takenOn,
      }),
    invoicesCsv: () => invoicesCsv(allInvoices()),
    creditNotesCsv: () => creditNotesCsv(notes),
  };
}
