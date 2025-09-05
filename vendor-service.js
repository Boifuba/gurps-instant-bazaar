const MODULE_ID = 'gurps-instant-bazaar';
const SOCKET = `module.${MODULE_ID}`;

function getVendors() {
  try {
    return game.settings.get(MODULE_ID, 'vendors');
  } catch (err) {
    console.warn('Setting gurps-instant-bazaar.vendors ausente', err);
    return {};
  }
}

function getVendor(vendorId) {
  const vendors = getVendors();
  return vendors[vendorId];
}

async function updateVendor(vendorId, vendorData) {
  const vendors = getVendors();
  vendors[vendorId] = vendorData;
  await game.settings.set(MODULE_ID, 'vendors', vendors);
  refreshVendorManagers();
  refreshVendorDisplays(vendorId);
  game.socket.emit(SOCKET, {
    type: 'vendorUpdated',
    vendorId,
    vendorData
  });
}

async function deleteVendor(vendorId) {
  const vendors = getVendors();
  delete vendors[vendorId];
  return game.settings.set(MODULE_ID, 'vendors', vendors);
}

function refreshVendorDisplays(vendorId) {
  Object.values(ui.windows).forEach(window => {
    if (window instanceof VendorDisplayApplication && window.vendorId === vendorId) {
      window.render();
    }
  });
}

function refreshVendorManagers() {
  Object.values(ui.windows).forEach(window => {
    if (window instanceof VendorManagerApplication) {
      window.render();
    }
  });
}

async function updateItemQuantityInVendor(vendorId, vendorItemId, change) {
  const vendor = getVendor(vendorId);
  if (!vendor) return;
  const itemIndex = vendor.items.findIndex(item => item.id === vendorItemId);
  if (itemIndex === -1) return;
  const item = vendor.items[itemIndex];
  const currentQuantity = item.quantity || 1;
  const newQuantity = Math.max(0, currentQuantity + change);
  if (newQuantity <= 0) {
    vendor.items = vendor.items.filter(item => item.id !== vendorItemId);
  } else {
    vendor.items[itemIndex].quantity = newQuantity;
  }
  await updateVendor(vendorId, vendor);
  refreshVendorManagers();
  game.socket.emit(SOCKET, {
    type: 'itemPurchased',
    vendorId,
    itemId: vendorItemId
  });
}

function findVendorByItemUuid(itemUuid) {
  const vendors = getVendors();
  for (const [vendorId, vendor] of Object.entries(vendors)) {
    const vendorItem = vendor.items.find(item => item.uuid === itemUuid);
    if (vendorItem) {
      return { vendorId, vendorItemId: vendorItem.id };
    }
  }
  return null;
}

module.exports = {
  MODULE_ID,
  SOCKET,
  getVendors,
  getVendor,
  updateVendor,
  deleteVendor,
  refreshVendorDisplays,
  refreshVendorManagers,
  updateItemQuantityInVendor,
  findVendorByItemUuid
};
