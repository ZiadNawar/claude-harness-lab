/**
 * The text of the messages customers get: renewal reminders, change
 * confirmations, payment reminders and credit note notices. Delivery happens
 * elsewhere. These only produce a subject and a body.
 */

import { formatLongDate } from '../core/dates.mjs';
import { formatAmount } from '../core/money.mjs';

function message(subject, paragraphs) {
  return { subject, body: `${paragraphs.join('\n\n')}\n` };
}

function greeting(customer) {
  return customer ? `Hello ${customer.name},` : 'Hello,';
}

export function renewalReminder({ customer, renewsOn, amount, currency, planName }) {
  return message(`Your ${planName} plan renews on ${formatLongDate(renewsOn)}`, [
    greeting(customer),
    `Your ${planName} plan renews on ${formatLongDate(renewsOn)}. ` +
      `We will invoice ${formatAmount(amount, currency)}, before any account credit you hold.`,
    'If you want to change your plan, you can do that any time before the renewal date.',
  ]);
}

export function changeConfirmation({ customer, invoice }) {
  const { currency, total, amountDue, creditApplied } = invoice;
  const paragraphs = [greeting(customer), `Your plan change is confirmed on invoice ${invoice.number}.`];
  if (total < 0) {
    paragraphs.push(`This leaves ${formatAmount(-total, currency)} of credit on your account.`);
  } else {
    paragraphs.push(`The change comes to ${formatAmount(total, currency)}.`);
    if (creditApplied > 0) {
      paragraphs.push(`We used ${formatAmount(creditApplied, currency)} of your account credit towards it.`);
    }
    paragraphs.push(`The amount to pay is ${formatAmount(amountDue, currency)}.`);
  }
  return message(`Your plan change, invoice ${invoice.number}`, paragraphs);
}

export function paymentReminder({ customer, invoice, balance, stage }) {
  const { currency, number } = invoice;
  const subjects = {
    overdue: `Invoice ${number} is overdue`,
    'first-reminder': `Reminder: invoice ${number} is unpaid`,
    'second-reminder': `Second reminder: invoice ${number} is unpaid`,
    'final-notice': `Final notice for invoice ${number}`,
  };
  if (!subjects[stage]) throw new RangeError(`Unknown reminder stage: ${stage}`);
  return message(subjects[stage], [
    greeting(customer),
    `We have not received full payment for invoice ${number}, ` +
      `issued on ${formatLongDate(invoice.issueDate)}. ` +
      `The open balance is ${formatAmount(balance, currency)}.`,
    'If you have already paid, please ignore this message.',
  ]);
}

export function creditNoteNotice({ customer, note }) {
  const { currency, settlement } = note;
  const paragraphs = [
    greeting(customer),
    `We have issued credit note ${note.number} for ${formatAmount(note.total, currency)} ` +
      `against invoice ${note.invoiceNumber}.`,
  ];
  if (note.reason) paragraphs.push(`Reason: ${note.reason}.`);
  if (settlement) {
    const { againstBalance, refunded, toAccount } = settlement;
    if (againstBalance > 0) {
      paragraphs.push(`${formatAmount(againstBalance, currency)} reduces what you owe on the invoice.`);
    }
    if (refunded > 0) {
      paragraphs.push(`${formatAmount(refunded, currency)} will be refunded to you.`);
    }
    if (toAccount > 0) {
      paragraphs.push(`${formatAmount(toAccount, currency)} goes back onto your account as credit.`);
    }
  }
  return message(`Credit note ${note.number}`, paragraphs);
}

export function welcomeNotice({ customer, planName, invoice }) {
  const { currency, number, amountDue, issueDate } = invoice;
  return message(`Welcome to ${planName}`, [
    greeting(customer),
    `Your ${planName} subscription started on ${formatLongDate(issueDate)}.`,
    `Your first invoice is ${number}, with ${formatAmount(amountDue, currency)} to pay.`,
  ]);
}

export function cancellationNotice({ customer, planName, endsOn, invoice = null }) {
  const paragraphs = [
    greeting(customer),
    `Your ${planName} subscription ends on ${formatLongDate(endsOn)}.`,
  ];
  if (invoice && invoice.total < 0) {
    const credit = formatAmount(-invoice.total, invoice.currency);
    paragraphs.push(`${credit} for the time you will not use is now on your account.`);
  }
  paragraphs.push('You can subscribe again at any time.');
  return message(`Your ${planName} subscription is ending`, paragraphs);
}

export function refundNotice({ customer, refund }) {
  const { amount, currency, noteNumber } = refund;
  return message(`Your refund for credit note ${noteNumber}`, [
    greeting(customer),
    `We have paid out ${formatAmount(amount, currency)} for credit note ${noteNumber}.`,
    'Depending on your bank it can take a few days to arrive.',
  ]);
}
