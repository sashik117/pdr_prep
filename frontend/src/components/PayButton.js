import { pay } from '@/api/payment';

export class PayButton {
  constructor(container, options) {
    this.options = options;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.textContent = options.label || 'Оплатити';
    this.button.addEventListener('click', () => this.handleClick());
    container.appendChild(this.button);
  }

  async handleClick() {
    const { planCode, returnUrl, onLoading, onError } = this.options;
    this.button.disabled = true;
    onLoading?.(true);

    try {
      await pay({ planCode, returnUrl });
    } catch (error) {
      console.error('LiqPay error:', error);
      onError?.(error);
    } finally {
      this.button.disabled = false;
      onLoading?.(false);
    }
  }
}
