import React, { useState } from 'react';
import { ShopItem, ShopCategory, UserProfile } from '../types';
import { playCoinSound, playFanfare, playPopSound, speakText } from '../utils/audio';
import { mergeShopItemsWithCatalog } from '../utils/storage';
import confetti from 'canvas-confetti';
import { ArrowLeft, Check } from 'lucide-react';
import { SCENERY_IMAGES } from '../utils/sceneryImages';
import magazaOduller from '../assets/images/magaza-oduller.webp';
import magazaTrenler from '../assets/images/magaza-trenler.webp';
import magazaVagonlar from '../assets/images/magaza-vagonlar.webp';
import magazaRaylar from '../assets/images/magaza-raylar.webp';
import magazaKasaba from '../assets/images/magaza-kasaba.webp';

interface ShopViewProps {
  shopItems: ShopItem[];
  user: UserProfile;
  onBuyItem: (itemId: string, price: number) => void;
  onSetActiveTrain: (icon: string) => void;
  soundEnabled: boolean;
  speechEnabled: boolean;
}

const CATEGORIES: Array<{ id: ShopCategory; label: string; detail: string; icon: string; image: string }> = [
  { id: 'rewards', label: 'Gerçek ödüller', detail: 'Büyüğünle birlikte al', icon: '🎁', image: magazaOduller },
  { id: 'trains', label: 'Trenler', detail: 'Yeni lokomotifler', icon: '🚂', image: magazaTrenler },
  { id: 'wagons', label: 'Vagonlar', detail: 'Trenine vagon ekle', icon: '🚃', image: magazaVagonlar },
  { id: 'tracks', label: 'Raylar', detail: 'Köprü, viraj, tünel', icon: '🛤️', image: magazaRaylar },
  { id: 'scenery', label: 'Kasaba', detail: 'Ev, ağaç, park', icon: '🏡', image: magazaKasaba },
];

function ItemPicture({ item, className }: { item: ShopItem; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {SCENERY_IMAGES[item.id] ? <img src={SCENERY_IMAGES[item.id]} alt="" draggable={false} /> : item.icon}
    </span>
  );
}

/**
 * Mağaza: önce kategori kartları, bir kategoriye girince yalnızca onun ürünleri.
 * Yanlışlıkla puan harcanmasın diye her alışveriş "Alalım mı?" sorusuyla onaylanır.
 */
export const ShopView: React.FC<ShopViewProps> = ({
  shopItems,
  user,
  onBuyItem,
  onSetActiveTrain,
  soundEnabled,
  speechEnabled,
}) => {
  const [category, setCategory] = useState<ShopCategory | null>(null);
  const [confirming, setConfirming] = useState<ShopItem | null>(null);
  const [bought, setBought] = useState<ShopItem | null>(null);

  const catalogItems = mergeShopItemsWithCatalog(shopItems);
  const current = CATEGORIES.find((cat) => cat.id === category);
  const items = catalogItems.filter((item) => item.category === category);

  const openCategory = (next: ShopCategory | null) => {
    playPopSound(soundEnabled);
    setCategory(next);
    window.scrollTo({ top: 0 });
  };

  const askToBuy = (item: ShopItem) => {
    if (user.coins < item.price) {
      speakText(`${item.price - user.coins} puan daha lazım. Görev yaparak kazanabilirsin!`, speechEnabled);
      return;
    }
    playPopSound(soundEnabled);
    speakText(`${item.name}, ${item.price} puan. Alalım mı?`, speechEnabled);
    setConfirming(item);
  };

  const confirmBuy = () => {
    const item = confirming;
    setConfirming(null);
    if (!item || user.coins < item.price) return;
    playCoinSound(soundEnabled);
    playFanfare(soundEnabled);
    confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 }, colors: ['#16A34A', '#0E9AA7', '#F59E0B', '#2563EB', '#7C3AED'] });
    onBuyItem(item.id, item.price);
    setBought(item);
    speakText(item.type === 'real_reward' ? 'Harika! Bir büyüğüne göster, ödülünü birlikte alın.' : `Harika! ${item.name} artık senin.`, speechEnabled);
  };

  const afterBuyText = (item: ShopItem) => {
    if (item.type === 'real_reward') return 'Bir büyüğüne göster, ödülünü birlikte alın!';
    if (item.type === 'train') return 'Dünya’da Hangar’dan bu treni sürebilirsin.';
    if (item.type === 'wagon' || item.category === 'wagons') return 'Dünya’da Hangar’dan trenine bağlayabilirsin.';
    return 'Dünya’da Kasabayı kur bölümünden yerleştirebilirsin.';
  };

  return (
    <div className="gt-shop">
      {current ? (
        <div className="gt-head gt-subhead">
          <button type="button" className="gt-back" onClick={() => openCategory(null)} aria-label="Mağaza menüsüne geri dön">
            <span className="ar" aria-hidden="true"><ArrowLeft strokeWidth={3.5} /></span>Geri
          </button>
          <h1 className="gt-wtitle"><img className="gt-menu-img" src={current.image} alt="" draggable={false} /> {current.label}</h1>
        </div>
      ) : (
        <>
          <div className="gt-head">
            <h1>Mağaza</h1>
          </div>
          <p className="gt-menu-hint">Ne almak istersin?</p>
        </>
      )}

      {!current && (
        <div className="gt-menu shop" aria-label="Mağaza bölümleri">
          {CATEGORIES.map((cat) => {
            const inCat = catalogItems.filter((item) => item.category === cat.id);
            const owned = inCat.filter((item) => item.unlocked).length;
            return (
              <button key={cat.id} type="button" className={`gt-menu-card s-${cat.id}`} onClick={() => openCategory(cat.id)}>
                <span className="e" aria-hidden="true">
                  <img className="gt-menu-img" src={cat.image} alt="" draggable={false} />
                </span>
                <span className="t">
                  {cat.label}
                  <small>{cat.id === 'rewards' ? cat.detail : `${owned} / ${inCat.length} sende`}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {current && (
        <div className="gt-shop-grid">
          {items.map((item) => {
            const missing = Math.max(0, item.price - user.coins);
            const isTrainActive = item.type === 'train' && user.activeTrainIcon === item.icon;
            return (
              <div key={item.id} className={`gt-sitem ${item.unlocked ? 'owned' : ''}`}>
                <ItemPicture item={item} className="pic" />
                <b className="nm">{item.name}</b>
                <span className="ds">{item.description}</span>
                {!item.unlocked && (
                  <span className="pr"><span className="gt-coin-dot small" aria-hidden="true" />{item.price}</span>
                )}
                {item.unlocked ? (
                  item.type === 'train' ? (
                    <button type="button" className={`gt-sbuy ${isTrainActive ? 'have' : 'use'}`} onClick={() => onSetActiveTrain(item.icon)} disabled={isTrainActive}>
                      {isTrainActive ? <><Check aria-hidden="true" />Sürüyorsun</> : 'Bunu sür'}
                    </button>
                  ) : (
                    <span className="gt-sbuy have"><Check aria-hidden="true" />Sende var</span>
                  )
                ) : missing > 0 ? (
                  <button type="button" className="gt-sbuy wait" onClick={() => askToBuy(item)}>
                    {missing} puan daha
                  </button>
                ) : (
                  <button type="button" className="gt-sbuy" onClick={() => askToBuy(item)}>Al</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirming && (
        <div className="gt-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="shop-confirm-title">
          <div className="gt-sheet-bg" onClick={() => setConfirming(null)} aria-hidden="true" />
          <div className="gt-sheet">
            <ItemPicture item={confirming} className="gt-sheet-pic" />
            <h2 id="shop-confirm-title">{confirming.name}</h2>
            <p className="gt-sheet-price">
              <span className="gt-coin-dot" aria-hidden="true" /><b>{confirming.price}</b> puan
              <small>Sonra {user.coins - confirming.price} puanın kalır</small>
            </p>
            <p className="gt-q">Alalım mı?</p>
            <div className="gt-pair">
              <button type="button" className="gt-ghost" onClick={() => setConfirming(null)}>Vazgeç</button>
              <button type="button" className="gt-big" onClick={confirmBuy}><Check aria-hidden="true" strokeWidth={3} />Evet, al</button>
            </div>
          </div>
        </div>
      )}

      {bought && (
        <div className="gt-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="shop-bought-title">
          <div className="gt-sheet-bg" onClick={() => setBought(null)} aria-hidden="true" />
          <div className="gt-sheet">
            <span className="gt-sheet-tag">🎉 Yeni!</span>
            <ItemPicture item={bought} className="gt-sheet-pic" />
            <h2 id="shop-bought-title">{bought.name} artık senin!</h2>
            <p className="gt-hint">{afterBuyText(bought)}</p>
            <button type="button" className="gt-big turkuaz" onClick={() => setBought(null)}>Harika!</button>
          </div>
        </div>
      )}
    </div>
  );
};
