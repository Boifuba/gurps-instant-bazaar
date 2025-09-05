const { getUserWallet, setUserWallet, formatCurrency } = require('./currency-service.js');
const { getVendor, updateItemQuantityInVendor } = require('./vendor-service.js');

async function addItemToActor(actor, uuid, quantity) {
  quantity = Number(quantity);
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
  const itemDoc = await fromUuid(uuid);
  if (!itemDoc) {
    return false;
  }
  let item = actor.items.find(i =>
    i._stats?.compendiumSource === uuid ||
    i.flags?.core?.sourceId === uuid ||
    i.system.globalid === uuid
  );
  if (item) {
    const current = item.system?.eqt?.count ?? 0;
    const total = current + quantity;
    const eqtUuid = item.system?.eqt?.uuid;
    const key = eqtUuid ? actor._findEqtkeyForId('uuid', eqtUuid) : undefined;
    if (typeof actor.updateEqtCount === 'function' && key) {
      await actor.updateEqtCount(key, total);
    } else {
      await item.update({ 'system.eqt.count': total });
    }
    return true;
  } else {
    let createdItem;
    if (typeof actor.handleItemDrop === 'function') {
      const dropData = { type: 'Item', uuid };
      if (actor.handleItemDrop.length >= 2) {
        createdItem = await actor.handleItemDrop(null, dropData);
      } else {
        createdItem = await actor.handleItemDrop(dropData);
      }
    } else if (typeof actor.createEmbeddedDocuments === 'function') {
      const itemData = itemDoc.toObject ? itemDoc.toObject() : { ...itemDoc };
      delete itemData._id;
      const result = await actor.createEmbeddedDocuments('Item', [itemData]);
      createdItem = Array.isArray(result) ? result[0] : result;
    }
    if (createdItem instanceof Item) {
      item = createdItem;
    } else if (Array.isArray(createdItem) && createdItem[0] instanceof Item) {
      item = createdItem[0];
    }
    if (!item) {
      item = actor.items.find(i =>
        i._stats?.compendiumSource === uuid ||
        i.flags?.core?.sourceId === uuid ||
        i.system?.globalid === uuid
      );
    }
    if (!(item instanceof Item)) {
      console.error(`💰 ERROR: Item was not added to character (UUID: ${uuid})`);
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
    const eqtUuid = item.system?.eqt?.uuid;
    const key = eqtUuid ? actor._findEqtkeyForId('uuid', eqtUuid) : undefined;
    if (typeof actor.updateEqtCount === 'function' && key) {
      await actor.updateEqtCount(key, quantity);
    } else {
      await item.update({ 'system.eqt.count': quantity });
    }
    return true;
  }
}

async function processItemPurchase(actor, item, vendorId, vendorItemId, quantity = 1) {
  const userId = game.user.id;
  const currentWallet = getUserWallet(userId);
  const itemPrice = parseInt(item?.system?.price ?? item?.price) || 0;
  if (vendorId && vendorItemId) {
    const vendor = getVendor(vendorId);
    const vendorItem = vendor?.items.find(i => i.id === vendorItemId);
    const stock = vendorItem?.quantity;
    if (stock !== undefined && stock < quantity) {
      ui.notifications.warn(`${item.name} is out of stock.`);
      return false;
    }
  }
  const totalPrice = itemPrice * quantity;
  if (currentWallet >= totalPrice) {
    await setUserWallet(userId, currentWallet - totalPrice);
    const sourceId =
      item._stats?.compendiumSource ||
      item.flags?.core?.sourceId ||
      item.system?.globalid;
    let actorItem = sourceId
      ? actor.items.find(i =>
          i._stats?.compendiumSource === sourceId ||
          i.flags?.core?.sourceId === sourceId ||
          i.system?.globalid === sourceId
        )
      : null;
    if (actorItem) {
      const isEquipment = actorItem.system?.eqt?.count !== undefined;
      const path = isEquipment ? 'system.eqt.count' : 'system.quantity';
      const total = (getProperty(actorItem, path) ?? 0) + quantity;
      if (isEquipment) {
        const key = actor._findEqtkeyForId('itemid', actorItem.id);
        if (!key || typeof actor.updateEqtCount !== 'function') {
          await actorItem.update({ [path]: total });
        } else {
          await actor.updateEqtCount(key, total);
        }
      } else {
        await actorItem.update({ [path]: total });
      }
    } else {
      const itemData = item.toObject();
      delete itemData._id;
      itemData._stats ??= {};
      itemData._stats.compendiumSource = sourceId;
      if (itemData.system?.eqt?.count !== undefined) itemData.system.eqt.count = quantity;
      else itemData.system.quantity = quantity;
      await actor.createEmbeddedDocuments('Item', [itemData]);
    }
    if (vendorId && vendorItemId) {
      await updateItemQuantityInVendor(vendorId, vendorItemId, -quantity);
    }
    ui.notifications.info(`${quantity}x ${item.name} purchased for ${formatCurrency(totalPrice)} and added to ${actor.name}'s inventory.`);
    return true;
  } else {
    ui.notifications.warn(`Not enough coins to purchase ${quantity}x ${item.name}. Need ${formatCurrency(totalPrice)} but only have ${formatCurrency(currentWallet)}.`);
    return false;
  }
}

async function handleItemDrop(actor, data) {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return true;
    }
  }
  if (data.type !== 'Item') return;
  const item = await fromUuid(data.uuid);
  if (!item) return;
  if (data.vendorId && data.vendorItemId) {
    let quantity = parseInt(data.quantity, 10);
    if (!quantity || quantity < 1) {
      const vendor = getVendor(data.vendorId);
      const vendorItem = vendor?.items.find(i => i.id === data.vendorItemId);
      const maxStock = vendorItem?.quantity;
      quantity = await Dialog.prompt({
        title: `Purchase Quantity`,
        content: `<p>How many ${item.name}?</p><input type="number" id="purchase-qty" value="1" min="1" ${maxStock !== undefined ? `max="${maxStock}"` : ''}>`,
        callback: html => parseInt(html.find('#purchase-qty').val(), 10) || 1
      });
    }
    await processItemPurchase(actor, item, data.vendorId, data.vendorItemId, quantity);
    return false;
  } else {
    return true;
  }
}

module.exports = {
  addItemToActor,
  processItemPurchase,
  handleItemDrop
};
