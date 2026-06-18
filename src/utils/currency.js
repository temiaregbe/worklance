const DEMO_USD_PER_ETH = 3500;
const DEMO_NGN_PER_USD = 1600;

export const supportedCurrencies = ["ETH", "USD", "NGN"];

const ratesPerEth = {
  ETH: 1,
  USD: DEMO_USD_PER_ETH,
  NGN: DEMO_USD_PER_ETH * DEMO_NGN_PER_USD
};

export function normalizeEthAmount(amount, currency = "ETH") {
  const numericAmount = Number(amount || 0);
  const normalizedCurrency = supportedCurrencies.includes(currency) ? currency : "ETH";

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "0";
  }

  const ethAmount = normalizedCurrency === "ETH"
    ? numericAmount
    : numericAmount / ratesPerEth[normalizedCurrency];

  return ethAmount.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

export function formatCurrencyAmount(amount, currency = "ETH") {
  const numericAmount = Number(amount || 0);
  const normalizedCurrency = supportedCurrencies.includes(currency) ? currency : "ETH";

  if (!Number.isFinite(numericAmount)) {
    return normalizedCurrency === "ETH" ? "0 ETH" : `0 ${normalizedCurrency}`;
  }

  return `${numericAmount} ${normalizedCurrency}`;
}

export function formatBudgetLabel(record) {
  if (record?.paymentAmountValue && record?.paymentCurrency) {
    const original = formatCurrencyAmount(record.paymentAmountValue, record.paymentCurrency);
    const ethAmount = record.paymentAmountEth || normalizeEthAmount(record.paymentAmountValue, record.paymentCurrency);
    return record.paymentCurrency === "ETH" ? original : `${original} (${ethAmount} ETH)`;
  }

  return `${record?.paymentAmountEth || "0"} ETH`;
}

export function formatProposalBidLabel(proposal) {
  if (proposal?.bidAmountValue && proposal?.bidCurrency) {
    const original = formatCurrencyAmount(proposal.bidAmountValue, proposal.bidCurrency);
    const ethAmount = proposal.bidAmountEth || normalizeEthAmount(proposal.bidAmountValue, proposal.bidCurrency);
    return proposal.bidCurrency === "ETH" ? original : `${original} (${ethAmount} ETH)`;
  }

  return `${proposal?.bidAmount || "0"} ETH`;
}

export function compareEthAmounts(left, right) {
  const leftAmount = Number(left || 0);
  const rightAmount = Number(right || 0);

  if (!Number.isFinite(leftAmount) || !Number.isFinite(rightAmount)) {
    return 0;
  }

  const difference = leftAmount - rightAmount;
  if (Math.abs(difference) <= 0.000001) {
    return 0;
  }

  return difference > 0 ? 1 : -1;
}
