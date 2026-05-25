import api from '@/api/apiClient';

export async function fetchPaymentData({ planCode, returnUrl }) {
  return api.createPremiumCheckout(planCode, returnUrl);
}

export function submitToLiqPay(data, signature, action = 'https://www.liqpay.ua/api/3/checkout') {
  document.getElementById('__liqpay_form')?.remove();

  const form = document.createElement('form');
  form.id = '__liqpay_form';
  form.method = 'POST';
  form.action = action;
  form.acceptCharset = 'utf-8';
  form.style.display = 'none';

  const appendHidden = (name, value) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  appendHidden('data', data);
  appendHidden('signature', signature);
  document.body.appendChild(form);
  form.submit();
}

export async function pay({ planCode, returnUrl }) {
  const payload = await fetchPaymentData({ planCode, returnUrl });
  if (payload.provider === 'mock') {
    return api.mockActivatePremium(payload.order_id);
  }
  if (!payload?.data || !payload?.signature) {
    throw new Error('Не вдалося підготувати LiqPay checkout');
  }
  submitToLiqPay(payload.data, payload.signature, payload.checkout_action);
  return payload;
}

export async function syncPaymentStatus(orderId) {
  return api.getPaymentStatus(orderId);
}
