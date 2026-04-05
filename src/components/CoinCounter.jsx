import React, { useState } from 'react';

function formatCurrency(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || 'USD'} ${Math.round(Number(amount) || 0)}`;
  }
}

export default function CoinCounter({
  coins = 0,
  userRewards = [],
  motivationReward = null,
  canRedeemMotivation = true,
  onToggleShopPurchase = () => {}
}) {
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemed, setRedeemed] = useState(new Set());

  const title = motivationReward?.title || '';
  const targetAmount = Math.max(0, Number(motivationReward?.targetAmount) || 0);
  const moneyPerCoin = Math.max(0, Number(motivationReward?.moneyPerCoin) || 0);
  const currency = motivationReward?.currency || 'USD';
  const shopItems = Array.isArray(motivationReward?.shopItems) ? motivationReward.shopItems : [];
  const purchasedItemIds = Array.isArray(motivationReward?.purchasedItemIds) ? motivationReward.purchasedItemIds : [];
  const convertedValue = coins * moneyPerCoin;
  const progressPct = targetAmount > 0 ? Math.min(100, Math.round((convertedValue / targetAmount) * 100)) : 0;
  const goalReachedByMoney = targetAmount > 0 && convertedValue >= targetAmount;
  const motivationUnlocked = goalReachedByMoney && canRedeemMotivation;

  const handleToggleRedeemed = (rewardId) => {
    const updated = new Set(redeemed);
    if (updated.has(rewardId)) {
      updated.delete(rewardId);
    } else {
      updated.add(rewardId);
    }
    setRedeemed(updated);
  };

  const handleShare = async () => {
    const status = motivationUnlocked ? 'Unlocked' : 'In progress';
    const text = `My NextStride dream reward update:\n${title || 'Dream reward'}\nStatus: ${status}\nCoins: ${coins}\nValue: ${formatCurrency(convertedValue, currency)} / ${formatCurrency(targetAmount, currency)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'NextStride Motivation Reward',
          text
        });
        return;
      }
      await navigator.clipboard.writeText(text);
      alert('Progress copied to clipboard.');
    } catch {
      alert('Could not share right now.');
    }
  };

  const handleShop = (queryText = title || 'motivational reward') => {
    const query = encodeURIComponent(queryText || 'motivational reward');
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenShopItem = (item) => {
    if (item?.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    handleShop(item?.name || title || 'motivational reward');
  };

  const canBuyItem = (itemPrice) => motivationUnlocked && convertedValue >= Math.max(0, Number(itemPrice) || 0);

  return (
    <>
      <div
        className="coin-counter"
        onClick={() => setShowRedeemModal(true)}
        title="Click to redeem rewards"
      >
        <span className="coin-emoji">🪙</span>
        <span className="coin-value">{coins}</span>
      </div>

      {showRedeemModal && (
        <div className="coin-redeem-overlay" onClick={() => setShowRedeemModal(false)}>
          <div
            className="coin-redeem-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="coin-modal-header">
              <h3>Your Rewards</h3>
              <button
                className="coin-modal-close"
                onClick={() => setShowRedeemModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="coin-modal-body">
              <div className="coin-balance">
                <span className="coin-emoji coin-large">🪙</span>
                <span className="coin-balance-text">{coins} coins earned</span>
              </div>

              {title && targetAmount > 0 && (
                <div className="coin-motivation-card">
                  <div className="coin-motivation-head">
                    <h4 className="coin-motivation-title">{title}</h4>
                    <span className={motivationUnlocked ? 'coin-motivation-badge unlocked' : 'coin-motivation-badge'}>
                      {motivationUnlocked ? 'Unlocked' : 'In Progress'}
                    </span>
                  </div>
                  <p className="coin-motivation-copy">
                    {formatCurrency(convertedValue, currency)} of {formatCurrency(targetAmount, currency)}
                  </p>
                  <div className="coin-motivation-progress">
                    <div className="coin-motivation-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  {!canRedeemMotivation && (
                    <p className="coin-motivation-lock-note">
                      Keep your active goals on pace to unlock this purchase.
                    </p>
                  )}
                  <div className="coin-motivation-actions">
                    <button type="button" className="secondary" onClick={handleShare}>Share progress</button>
                    <button type="button" className="secondary" onClick={() => handleShop()} disabled={!motivationUnlocked} title={motivationUnlocked ? 'Open shop search' : 'Unlock first'}>
                      Open shop
                    </button>
                  </div>
                </div>
              )}

              {!!shopItems.length && (
                <div className="coin-shop-catalog">
                  <p className="coin-rewards-label">Dream shop catalog</p>
                  <div className="coin-shop-grid">
                    {shopItems.map((item) => {
                      const purchased = purchasedItemIds.includes(item.id);
                      const canBuy = canBuyItem(item.price);

                      return (
                        <article key={item.id} className={purchased ? 'coin-shop-item purchased' : 'coin-shop-item'}>
                          <div className="coin-shop-top">
                            <h5>{item.name}</h5>
                            <span>{formatCurrency(item.price, currency)}</span>
                          </div>
                          <div className="coin-shop-actions">
                            <button type="button" className="secondary" onClick={() => handleOpenShopItem(item)}>
                              View
                            </button>
                            <button
                              type="button"
                              className={purchased ? 'secondary' : 'primary'}
                              onClick={() => onToggleShopPurchase(item.id)}
                              disabled={!purchased && !canBuy}
                              title={!purchased && !canBuy ? 'Need unlock + enough converted value' : 'Toggle purchase'}
                            >
                              {purchased ? 'Purchased' : 'Mark bought'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {userRewards.length === 0 ? (
                <div className="coin-rewards-empty">
                  <p>No rewards defined yet. Add your favorite treats and small rewards to your Settings.</p>
                </div>
              ) : (
                <div className="coin-rewards-list">
                  <p className="coin-rewards-label">Mark your rewards as you enjoy them:</p>
                  {userRewards.map((reward, idx) => (
                    <label key={idx} className="coin-reward-item">
                      <input
                        type="checkbox"
                        checked={redeemed.has(idx)}
                        onChange={() => handleToggleRedeemed(idx)}
                      />
                      <span className="coin-reward-text">{reward}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="coin-modal-footer">
              <p className="coin-encouragement">
                Use your coins to celebrate wins. You've earned this. 🎉
              </p>
              <button
                className="coin-modal-button"
                onClick={() => setShowRedeemModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
