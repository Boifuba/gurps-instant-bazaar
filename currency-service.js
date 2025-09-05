const { MODULE_ID } = require('./vendor-service.js');
const currency = require('./currency.js');

function formatCurrency(amount) {
  return '$' + Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseCurrency(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    return Number(value.replace(/[^0-9.-]+/g, '')) || 0;
  }
  return 0;
}

function _flattenItemsFromObject(obj) {
  const items = [];
  if (typeof obj !== 'object' || obj === null) {
    return items;
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        if (value.name !== undefined) {
          items.push(value);
        } else {
          items.push(..._flattenItemsFromObject(value));
        }
      }
    }
  }
  return items;
}

function _getCharacterSheetCoinBreakdown(userId) {
  const user = game.users.get(userId);
  if (!user?.character) {
    console.warn(`No character assigned to user ${user?.name || userId}`);
    return [];
  }
  const actor = user.character;
  const carried = actor.system?.equipment?.carried;
  if (!carried) {
    console.warn(`No equipment.carried found for character ${actor.name}`);
    return [];
  }
  const denominations = game.settings.get(MODULE_ID, 'currencyDenominations') || [];
  const coinBreakdown = [];
  const carriedItems = _flattenItemsFromObject(carried);
  for (const denom of denominations) {
    const matchingItems = carriedItems.filter(item => item.name === denom.name && item.carried === true);
    for (const item of matchingItems) {
      const count = item.count || 0;
      const value = denom.value || 0;
      if (count > 0 && value > 0) {
        coinBreakdown.push({ name: denom.name, totalValue: count * value });
      }
    }
  }
  return coinBreakdown;
}

function _getCharacterSheetCurrency(userId) {
  const coinBreakdown = _getCharacterSheetCoinBreakdown(userId);
  let totalValue = 0;
  for (const coin of coinBreakdown) {
    totalValue += coin.totalValue;
  }
  return totalValue;
}

function getUserWallet(userId) {
  const useModuleCurrency = game.settings.get(MODULE_ID, 'useModuleCurrencySystem');
  if (!useModuleCurrency) {
    return _getCharacterSheetCurrency(userId);
  }
  const user = game.users.get(userId);
  return Number(user?.getFlag(MODULE_ID, 'wallet')) || 0;
}

async function setUserWallet(userId, amount) {
  const useModuleCurrency = game.settings.get(MODULE_ID, 'useModuleCurrencySystem');
  if (!useModuleCurrency) {
    console.warn('Module currency system is disabled. Direct wallet changes are not allowed. Currency is managed through character sheet items.');
    return false;
  }
  const user = game.users.get(userId);
  return await user?.setFlag(MODULE_ID, 'wallet', Math.max(0, amount));
}

module.exports = {
  ...currency,
  formatCurrency,
  parseCurrency,
  _flattenItemsFromObject,
  _getCharacterSheetCoinBreakdown,
  _getCharacterSheetCurrency,
  getUserWallet,
  setUserWallet
};
