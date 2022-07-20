import React, { useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import {
  ConfirmStripePaymentParams,
  CreatePaymentParams,
  Order,
  PaymentCurrencyType,
  PaymentIntentInfo,
  PaymentMethodType,
  SingleBase
} from '@liqnft/candy-shop-types';
import { CandyShopPay } from '@liqnft/candy-shop-sdk';
import { StripeCardDetail } from './StripeCardDetail';
import { NFTPaymentStatus, ShopExchangeInfo } from 'model';
import { useCallback } from 'react';
import { notification, NotificationType } from 'utils/rc-notification';
import { Processing } from 'components/Processing';
import { useUnmountTimeout } from 'hooks/useUnmountTimeout';
import { TIMEOUT_EXTRA_LOADING } from 'constant';
import { Viewer } from 'components/Viewer';
import { NftVerification } from 'components/Tooltip/NftVerification';
import { getPrice } from 'utils/getPrice';
import stripeLogo from '../../assets/stripe.png';

const Logger = 'CandyShopUI/StripePayment';

interface StripePaymentProps {
  stripePublicKey: string;
  shopProgramId: string;
  shopAddress: string;
  walletAddress: string;
  order: Order;
  exchangeInfo: ShopExchangeInfo;
  shopPriceDecimalsMin: number;
  shopPriceDecimals: number;
}

export const StripePayment: React.FC<StripePaymentProps> = ({
  stripePublicKey,
  shopProgramId,
  shopAddress,
  walletAddress,
  order,
  shopPriceDecimals,
  shopPriceDecimalsMin,
  exchangeInfo
}) => {
  const stripePromise = loadStripe(stripePublicKey);
  const [paymentId, setPaymentId] = useState<string>();
  const [nftPaymentStatus, setNFTPaymentStatus] = useState<NFTPaymentStatus>(NFTPaymentStatus.Init);
  const [failReason, setFailReason] = useState<string>();
  // TODO: Backend needs to provide an API to get USD currencyAmount from current order's price
  const [currencyAmount, setCurrencyAmount] = useState<number>(500);

  const timeoutRef = useUnmountTimeout();

  const initCardPayment = useCallback(() => {
    const params: CreatePaymentParams = {
      shopProgramId: shopProgramId,
      shopId: shopAddress,
      shopCreatorAddress: order.candyShopCreatorAddress,
      buyerWalletAddress: walletAddress,
      tokenAccount: order.tokenAccount,
      methodType: PaymentMethodType.CARD,
      currency: PaymentCurrencyType.USD,
      currencyAmount: currencyAmount
    };
    CandyShopPay.createPayment(params)
      .then((res: SingleBase<PaymentIntentInfo>) => {
        if (res.success && res.result) {
          console.log(`${Logger}: createPayment success, res=`, res.result);
          setPaymentId(res.result.paymentId);
        } else {
          console.log(`${Logger}: createPayment failed, reason=`, res.msg);
          if (res.msg) {
            notification(res.msg, NotificationType.Error, 5);
          }
        }
      })
      .catch((err: Error) => {
        console.error(`${Logger}: createPayment failed, error=`, err);
        notification(err.message, NotificationType.Error, 5);
      });
  }, [shopProgramId, shopAddress, walletAddress, order, currencyAmount]);

  useEffect(() => {
    if (nftPaymentStatus === NFTPaymentStatus.Init) {
      initCardPayment();
    }
  }, [nftPaymentStatus, initCardPayment]);

  const onCancelPayment = () => {
    console.log('debugger: closing StripePayment');
  };

  const onClickedPay = (params: ConfirmStripePaymentParams) => {
    setNFTPaymentStatus(NFTPaymentStatus.Processing);
    CandyShopPay.confirmPayment(params)
      .then((res: SingleBase<PaymentIntentInfo>) => {
        console.log('debugger: confirmPayment res=', res);
        if (res.success && res.result) {
          timeoutRef.current = setTimeout(() => {
            setNFTPaymentStatus(NFTPaymentStatus.Succeed);
          }, TIMEOUT_EXTRA_LOADING);
          console.log(`${Logger}: confirmPayment success=`, res.result);
        } else {
          setNFTPaymentStatus(NFTPaymentStatus.Failed);
          console.log(`${Logger}: confirmPayment failed, reason=`, res.msg);
          if (res.msg) {
            setFailReason(res.msg);
            notification(res.msg, NotificationType.Error, 5);
          }
        }
      })
      .catch((err: Error) => {
        setNFTPaymentStatus(NFTPaymentStatus.Failed);
        setFailReason(err.message);
        console.log(`${Logger}: handleCreatePayment failed, err=`, err);
        notification(err.message, NotificationType.Error, 5);
      });
  };

  const orderPrice = getPrice(shopPriceDecimalsMin, shopPriceDecimals, order, exchangeInfo);

  return (
    <>
      {nftPaymentStatus === NFTPaymentStatus.Init && (
        <div className="candy-buy-modal candy-buy-stripe">
          <div>
            <div className="candy-buy-modal-thumbnail">
              <Viewer order={order} />
            </div>
            <div className="candy-buy-modal-title">
              {order?.name}
              {order.verifiedNftCollection ? <NftVerification size={24} /> : null}
            </div>
            <div className="candy-label">CURRENT PRICE</div>
            <div className="candy-price">
              {orderPrice ? `${orderPrice} ${exchangeInfo.symbol}` : 'N/A'}
              <span className="candy-price-usd">&nbsp;| $ 81.28 USD</span>
            </div>
            <div style={{ textAlign: 'left', marginTop: '10px' }}>
              USD/SGD price is for reference only and subject to final confirmation{' '}
              <span className="candy-stripe-note">
                (include disclaimers here for fees + buy buffer spread) - VN will update
              </span>
            </div>
          </div>
          <div>
            <div className="candy-title">Credit Card Payment</div>
            <div className="candy-stripe-logo">
              Powered by <img src={stripeLogo} alt="stripe logo" />
            </div>

            <div className="candy-stripe-block">
              Before buying, please confirm that this is your address. If incorrect, reconnect your wallet.
              <span>{walletAddress}</span>
            </div>

            {paymentId ? (
              <Elements stripe={stripePromise}>
                <StripeCardDetail
                  paymentId={paymentId}
                  shopAddress={shopAddress}
                  tokenAccount={order.tokenAccount}
                  onClickedPayCallback={onClickedPay}
                />
              </Elements>
            ) : null}
          </div>
        </div>
      )}
      {nftPaymentStatus === NFTPaymentStatus.Processing && <Processing text="Processing credit card payment" />}
      {nftPaymentStatus === NFTPaymentStatus.Succeed && <div>Credit Card Confirmed</div>}
      {nftPaymentStatus === NFTPaymentStatus.Failed && (
        <div>
          <div>Payment Failed</div>
          {failReason && <div> Reason: {failReason} </div>}
        </div>
      )}
    </>
  );
};
