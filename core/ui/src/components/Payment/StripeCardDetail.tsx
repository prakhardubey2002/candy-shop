import './card-payment-form.less';
import React from 'react';
import { useElements, useStripe, CardCvcElement, CardNumberElement, CardExpiryElement } from '@stripe/react-stripe-js';
import {
  CreatePaymentMethodCardData,
  CreatePaymentMethodData,
  PaymentMethod,
  PaymentMethodResult,
  StripeCardNumberElementOptions
} from '@stripe/stripe-js';
import { ConfirmStripePaymentParams, PaymentMethodType } from '@liqnft/candy-shop-types';
import { LoadingSkeleton } from 'components/LoadingSkeleton';

const Logger = 'CandyShopUI/CardPaymentModal';

export interface StripeCardDetailProps {
  paymentId: string;
  shopAddress: string;
  tokenAccount: string;
  onClickedPayCallback: (param: ConfirmStripePaymentParams) => void;
}

export const StripeCardDetail: React.FC<StripeCardDetailProps> = ({
  paymentId,
  shopAddress,
  tokenAccount,
  onClickedPayCallback
}) => {
  const stripe = useStripe();
  const stripeElements = useElements();

  if (!stripe || !stripeElements) {
    console.log(`${Logger}: Loading Stripe.js`);
    return <LoadingSkeleton />;
  }

  const getPaymentMethod = (paymentMethodData: CreatePaymentMethodData): Promise<PaymentMethod> => {
    return stripe.createPaymentMethod(paymentMethodData).then((result: PaymentMethodResult) => {
      if (result.error) {
        throw result.error;
      }
      if (!result.paymentMethod) {
        throw Error('Undefined PaymentMethod');
      }
      return result.paymentMethod;
    });
  };

  // TODO: Check element change to enable/disable Pay button

  const getConfirmPaymentParams = async () => {
    const cardPaymentElement = stripeElements.getElement('cardNumber');
    if (!cardPaymentElement) {
      throw Error('Abort submit payment, StripePaymentElement is null');
    }
    const paymentMethodData: CreatePaymentMethodCardData = {
      type: 'card',
      card: cardPaymentElement
    };
    const paymentMethod = await getPaymentMethod(paymentMethodData);
    const params: ConfirmStripePaymentParams = {
      paymentId,
      paymentMethodId: paymentMethod.id,
      shopId: shopAddress,
      tokenAccount
    };
    return params;
  };

  const onClickedPay = () => {
    getConfirmPaymentParams()
      .then((res: ConfirmStripePaymentParams) => {
        onClickedPayCallback(res);
      })
      .catch((err: Error) => {
        console.log(`${Logger}: getConfirmPaymentParams failed, err=`, err);
      });
  };

  return (
    <div className="card-payment-modal-container">
      <label>Credit Card Number*</label>
      <div className="stripe-input">
        <CardNumberElement options={numberOptions} />
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ width: '40%', marginRight: '8px' }}>
          <label>Expiration Date*</label>
          <div className="stripe-input">
            <CardExpiryElement options={expOptions} />
          </div>
        </div>
        <div style={{ flexGrow: 1 }}>
          <label>CVC*</label>
          <div className="stripe-input">
            <CardCvcElement />
          </div>
        </div>
      </div>

      <div className="candy-stripe-terms">
        By proceeding with this transaction, I agree to the <span>CandyShop Terms & Conditions.</span> I acknowledge
        that transactions on the blockchain are final and non-refundable.
      </div>
      <div className="card-payment-modal-button">
        <button className="candy-button" onClick={onClickedPay}>
          Confirm
        </button>
      </div>
    </div>
  );
};

// TODO: Customize CardElement styling by overriding stripe's style
const numberOptions: StripeCardNumberElementOptions = {
  placeholder: '0000-0000-0000-0000',
  showIcon: true,
  style: {
    base: {
      color: 'blue',
      fontSize: '16px',
      padding: '8px'
    }
  }
};
const expOptions: StripeCardNumberElementOptions = {
  style: {
    base: {
      color: 'blue',
      fontSize: '16px',
      padding: '8px'
    }
  }
};
