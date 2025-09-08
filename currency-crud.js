/**
 * @file Character currency CRUD operations
 * @description Centralized service for managing currency items directly on character sheets (GURPS/GGA)
 */

import { makeChange, _calculateBaseUnitMultiplier } from './currency.js';

/**
 * (Opcional) Constrói dados completos de moeda. Útil para inicializações diretas.
 * No fluxo GGA abaixo, usamos Equipment/toItemData e internalUpdate.
 */
export function createCompleteGURPSCoinItem(denomination, count = 0) {
  const currentDate = new Date().toISOString();
  const uuid = foundry.utils.randomID(16);
  const itemId = foundry.utils.randomID(16);

  return {
    name: denomination.name,
    notes: "",
    pageref: denomination.pageref || "B264",
    count: Number.isFinite(count) ? count : 0,
    weight: Number(denomination.weight) || 0,
    cost: Number(denomination.value) || 0,
    location: "",
    carried: true,
    equipped: false,
    techlevel: denomination.techlevel ?? 1,
    categories: denomination.categories || "",
    legalityclass: denomination.legalityclass || "",
    uses: null,
    maxuses: 0,
    parentuuid: "",
    uuid,
    contains: {},
    originalName: denomination.name,
    originalCount: 0,
    ignoreImportQty: false,
    last_import: currentDate,
    save: true,
    itemid: itemId,
    img: denomination.img || "icons/svg/item-bag.svg"
  };
}

/* ============================== HELPERS GGA ============================== */

/** Caminho da lista de itens carregados na ficha GURPS. */
const CARRIED_PATH = "system.equipment.carried";

/**
 * Lê a lista GGA do caminho indicado.
 * @param {Actor} actor
 * @param {string} path
 * @returns {Record<string, any>}
 */
function readGGAList(actor, path = CARRIED_PATH) {
  return GURPS.decode(actor, path) || {};
}

/**
 * Upsert de uma moeda via GGA. Mantém um único item por denominação, remove duplicatas e preserva placeholder com count=0.
 * Cria Item Foundry quando `gurps.use-foundry-items` estiver ativo.
 * @param {Actor} actor
 * @param {Object} denomination { name, value, weight, ... }
 * @param {number} count
 * @param {string} path
 */
async function upsertCoinGGA(actor, denomination, count, path = CARRIED_PATH) {
  const { Equipment } = await import("/systems/gurps/module/actor/actor-components.js");

  const list = readGGAList(actor, path);
  const entries = Object.entries(list).filter(([_, it]) => it?.name === denomination.name);

  // Primeira ocorrência (mantida)
  let keepId = entries[0]?.[0];
  const keepData = entries[0]?.[1];

  // Monta o Equipment atualizado
  const eq = new Equipment(denomination.name, true);
  eq.count = Number(count) || 0;
  eq.cost = Number(denomination.value) || 0;
  eq.weight = Number(denomination.weight) || 0;
  eq.notes = "";
  eq.equipped = false;
  eq.carried = true;
  eq.techlevel = denomination.techlevel ?? 1;
  eq.categories = denomination.categories || "";
  eq.legalityclass = denomination.legalityclass || "";
  eq.img = denomination.img || "icons/svg/item-bag.svg";

  // Foundry Items (opcional)
  if (game.settings.get("gurps", "use-foundry-items")) {
    eq.save = true;
    if (keepData?.itemid) {
      eq.itemid = keepData.itemid;
    } else {
      const type = path.split(".")[2] || "carried";
      const [item] = await actor.createEmbeddedDocuments("Item", [eq.toItemData(actor, type)]);
      eq.itemid = item._id;
    }
  }

  // UUID GGA
  eq.uuid = keepData?.uuid || eq._getGGAId({ name: eq.name, type: path.split(".")[2] || "carried", generator: "" });

  // grava/atualiza
  if (!keepId) {
    GURPS.put(list, foundry.utils.duplicate(eq)); // cria placeholder mesmo se count=0
  } else {
    list[keepId] = foundry.utils.duplicate(eq);
    // remove duplicatas excedentes
    for (const [dupId] of entries.slice(1)) delete list[dupId];
  }

  await actor.internalUpdate({ [path]: list });
  if (actor.sheet?.rendered) actor.sheet.render(false);
}

/**
 * Obtém ator do usuário. Prioriza personagem atribuído.
 * @param {string} userId
 * @returns {Actor|null}
 */
function resolveActorFromUser(userId) {
  const user = game.users.get(userId);
  if (!user) return null;
  if (user.character) return user.character;

  const OWNER = foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const owned = game.actors.filter(a => a.hasPlayerOwner && a.ownership?.[userId] >= OWNER);
  return owned[0] ?? null;
}

/* ============================ SERVICE PRINCIPAL =========================== */

export default class CharacterCurrencyService {
  /**
   * @param {string} moduleId
   * @param {number} baseUnitMultiplier
   */
  constructor(moduleId, baseUnitMultiplier) {
    this.moduleId = moduleId;
    this.baseUnitMultiplier = Number(baseUnitMultiplier) || 0;
  }

  /**
   * Soma total em valor nominal.
   * @param {string} userId
   * @returns {number}
   */
  getCharacterSheetCurrency(userId) {
    const coins = this.getCharacterSheetCoinBreakdown(userId);
    let total = 0;
    for (const c of coins) total += (Number(c.count) || 0) * (Number(c.value) || 0);
    return total;
  }

  /**
   * Quebra por denominação. Sempre retorna todas as denominações.
   * @param {string} userId
   * @returns {{name:string,count:number,value:number,itemIds:string[]}[]}
   */
  getCharacterSheetCoinBreakdown(userId) {
    const actor = resolveActorFromUser(userId);
    if (!actor) return [];

    const denoms = game.settings.get(this.moduleId, "currencyDenominations") || [];
    const list = readGGAList(actor);
    const carriedEntries = Object.entries(list); // [id, data]

    const out = [];
    for (const d of denoms) {
      const matches = carriedEntries.filter(([_, it]) => it?.name === d.name);
      const count = matches.reduce((s, [_, it]) => s + (Number(it?.count) || 0), 0);
      const ids = matches.map(([id]) => id);
      out.push({ name: d.name, count, value: Number(d.value) || 0, itemIds: ids });
    }
    return out;
  }

  /**
   * Define o total de moedas. Distribui via makeChange. Preserva placeholder.
   * @param {string} userId
   * @param {number} newAmount
   * @returns {Promise<boolean>}
   */
  async setCharacterSheetCurrency(userId, newAmount) {
    const actor = resolveActorFromUser(userId);
    if (!actor) return false;

    const denoms = (game.settings.get(this.moduleId, "currencyDenominations") || []).slice();
    if (!denoms.length) return false;

    denoms.sort((a, b) => Number(b.value) - Number(a.value));

    const mul = this.baseUnitMultiplier > 0 ? this.baseUnitMultiplier : _calculateBaseUnitMultiplier(denoms);
    const scaled = denoms.map(d => ({ ...d, value: Math.round(Number(d.value) * mul) }));
    const target = Math.max(0, Math.round((Number(newAmount) || 0) * mul));

    try {
      const bag = makeChange(target, scaled); // { [name]: count }
      for (const d of denoms) {
        const cnt = Number(bag[d.name] || 0);
        await upsertCoinGGA(actor, d, cnt);
      }
      this.refreshWalletApplications();
      return true;
    } catch (e) {
      console.error("setCharacterSheetCurrency error:", e);
      return false;
    }
  }

  /**
   * Incrementa ou decrementa dinheiro e reescreve distribuição.
   * @param {Actor} actor
   * @param {number} amount
   */
  async addMoneyToCharacterCoins(actor, amount) {
    const denoms = game.settings.get(this.moduleId, "currencyDenominations") || [];
    if (!denoms.length) return;

    const list = readGGAList(actor);
    const entries = Object.entries(list); // [id, data]

    const mul = this.baseUnitMultiplier > 0 ? this.baseUnitMultiplier : _calculateBaseUnitMultiplier(denoms);
    const scaled = denoms.map(d => ({ ...d, value: Math.round(Number(d.value) * mul) }))
                         .sort((a, b) => b.value - a.value);

    // total atual escalado
    const currentScaled = entries.reduce((sum, [_, it]) => {
      const d = scaled.find(x => x.name === it?.name);
      return d ? sum + (Math.round(Number(it?.count) || 0) * Number(d.value)) : sum;
    }, 0);

    const delta = Math.round((Number(amount) || 0) * mul);
    const nextScaled = Math.max(0, currentScaled + delta);

    const bag = makeChange(nextScaled, scaled); // { [name]: count }

    for (const d of denoms) {
      const cnt = Number(bag[d.name] || 0);
      await upsertCoinGGA(actor, d, cnt);
    }
  }

  /**
   * Garante placeholder (count=0) para toda denominação ausente em todos os atores-jogador.
   */
  async initializeMissingActorCoins() {
    const denoms = game.settings.get(this.moduleId, "currencyDenominations") || [];
    if (!denoms.length) {
      ui.notifications.warn('No currency denominations configured. Configure as moedas primeiro.');
      return;
    }

    for (const actor of game.actors.contents) {
      if (actor.type !== 'character' || !actor.isOwner) continue;

      const list = readGGAList(actor);
      const names = new Set(Object.values(list).map(it => it?.name).filter(Boolean));

      for (const d of denoms) {
        if (!names.has(d.name)) {
          await upsertCoinGGA(actor, d, 0);
        }
      }
    }
    this.refreshWalletApplications();
  }

  /**
   * Atualiza janelas relacionadas.
   */
  refreshWalletApplications() {
    for (const app of Object.values(ui.windows)) {
      const k = app?.constructor?.name;
      if (k === 'PlayerWalletApplication' || k === 'VendorDisplayApplication' || k === 'MoneyManagementApplication') {
        app.render(false);
      }
    }
  }
}
