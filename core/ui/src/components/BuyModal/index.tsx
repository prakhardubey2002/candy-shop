import { CandyShopTrade, CandyShopTradeBuyParams } from '@liqnft/candy-shop-sdk';
import { Order as OrderSchema } from '@liqnft/candy-shop-types';
import { BN, web3 } from '@project-serum/anchor';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { Modal } from 'components/Modal';
import { StripePayment } from 'components/Payment';
import { PoweredByInBuyModal } from 'components/PoweredBy/PowerByInBuyModal';
import { Processing } from 'components/Processing';
import { TIMEOUT_EXTRA_LOADING } from 'constant';
import { useCandyShopPayContext } from 'contexts/CandyShopPayProvider';
import { useUnmountTimeout } from 'hooks/useUnmountTimeout';
import { ShopExchangeInfo } from 'model';
import React, { useState } from 'react';
import { ErrorMsgMap, ErrorType, handleError } from 'utils/ErrorHandler';
import { notification, NotificationType } from 'utils/rc-notification';
import { BuyModalConfirmed } from './BuyModalConfirmed';
import { BuyModalDetail } from './BuyModalDetail';
import './style.less';

enum ModalType {
  DISPLAY,
  PROCESSING,
  CONFIRMED,
  PAYMENT
}

export interface BuyModalProps {
  order: OrderSchema;
  onClose: () => void;
  wallet: AnchorWallet | undefined;
  walletConnectComponent: React.ReactElement;
  exchangeInfo: ShopExchangeInfo;
  shopAddress: web3.PublicKey;
  candyShopProgramId: web3.PublicKey;
  connection: web3.Connection;
  isEnterprise: boolean;
  shopPriceDecimalsMin: number;
  shopPriceDecimals: number;
  sellerUrl?: string;
}

export const BuyModal: React.FC<BuyModalProps> = ({
  order,
  onClose,
  wallet,
  walletConnectComponent,
  exchangeInfo,
  shopAddress,
  candyShopProgramId,
  connection,
  isEnterprise,
  shopPriceDecimalsMin,
  shopPriceDecimals,
  sellerUrl
}) => {
  const [state, setState] = useState<ModalType>(ModalType.DISPLAY);
  const [hash, setHash] = useState(''); // txHash

  const timeoutRef = useUnmountTimeout();

  const stripePublicKey = useCandyShopPayContext()?.stripePublicKey;

  const buy = async () => {
    if (!wallet) {
      notification(ErrorMsgMap[ErrorType.InvalidWallet], NotificationType.Error);
      return;
    }
    setState(ModalType.PROCESSING);

    const tradeBuyParams: CandyShopTradeBuyParams = {
      tokenAccount: new web3.PublicKey(order.tokenAccount),
      tokenMint: new web3.PublicKey(order.tokenMint),
      price: new BN(order.price),
      wallet: wallet,
      seller: new web3.PublicKey(order.walletAddress),
      connection: connection,
      shopAddress: shopAddress,
      candyShopProgramId: candyShopProgramId,
      isEnterprise: isEnterprise,
      // Replace with the order's
      shopCreatorAddress: new web3.PublicKey(order.candyShopCreatorAddress),
      shopTreasuryMint: new web3.PublicKey(order.treasuryMint)
    };

    return CandyShopTrade.buy(tradeBuyParams)
      .then((txHash) => {
        setHash(txHash);
        console.log('Buy order made with transaction hash', txHash);
        timeoutRef.current = setTimeout(() => {
          setState(ModalType.CONFIRMED);
        }, TIMEOUT_EXTRA_LOADING);
      })
      .catch((err) => {
        console.log({ err });
        handleError({ error: err });
        setState(ModalType.DISPLAY);
      });
  };
  const modalWidth = state === ModalType.DISPLAY || state === ModalType.PAYMENT ? 1000 : 600;
  return (
    <Modal className="candy-buy-modal-container" onCancel={onClose} width={modalWidth}>
      <div className="candy-buy-modal">
        {state === ModalType.DISPLAY && (
          <BuyModalDetail
            order={order}
            buy={buy}
            walletPublicKey={wallet?.publicKey}
            walletConnectComponent={walletConnectComponent}
            exchangeInfo={exchangeInfo}
            shopPriceDecimalsMin={shopPriceDecimalsMin}
            shopPriceDecimals={shopPriceDecimals}
            sellerUrl={sellerUrl}
            shopProgramId={candyShopProgramId.toString()}
            shopAddress={shopAddress.toString()}
            onPayment={() => setState(ModalType.PAYMENT)}
          />
        )}
        {state === ModalType.PROCESSING && <Processing text="Processing purchase" />}
        {state === ModalType.CONFIRMED && wallet && (
          <BuyModalConfirmed
            walletPublicKey={wallet.publicKey}
            order={order}
            txHash={hash}
            onClose={onClose}
            exchangeInfo={exchangeInfo}
            shopPriceDecimalsMin={shopPriceDecimalsMin}
            shopPriceDecimals={shopPriceDecimals}
          />
        )}

        {state === ModalType.PAYMENT && stripePublicKey && wallet?.publicKey && order && (
          <StripePayment
            stripePublicKey={stripePublicKey}
            shopProgramId={candyShopProgramId.toString()}
            shopAddress={shopAddress.toString()}
            walletAddress={wallet.publicKey.toString()}
            order={order}
            shopPriceDecimals={shopPriceDecimals}
            shopPriceDecimalsMin={shopPriceDecimalsMin}
            exchangeInfo={exchangeInfo}
          />
        )}
      </div>
      <PoweredByInBuyModal />
    </Modal>
  );
};
