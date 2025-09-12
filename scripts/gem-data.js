/**
 * @file Gem data and calculation functions
 * @description Contains gem definitions and calculation logic for the gem distribution system
 */

/**
 * Base values for different gem types
 * @type {Object<string, number>}
 */
export const gemValues = {
  "Agate": 5, "Azurite": 10, "Chalcedony": 10, "Hematite": 5, "Jade": 20, "Jet": 10,
  "Magnetite": 5, "Malachite": 15, "Obsidian": 2, "Quartz": 15, "Amber": 25, "Amethyst": 30,
  "Calcite": 20, "Sard": 25, "Coral": 20, "Lapis Lazuli": 25, "Onyx": 20, "Tourmaline": 25,
  "Turquoise": 20, "Aquamarine": 30, "Beryl": 30, "Bloodstone": 30, "Cat's Eye": 30,
  "Emerald": 35, "Garnet": 35, "Iolite": 30, "Moonstone": 30, "Opal": 35, "Pearl": 35,
  "Peridot": 30, "Ruby": 35, "Sapphire": 35, "Topaz": 35, "Diamond": 40
};

/**
 * Available carat sizes for gems
 * @type {Array<number>}
 */
export const caratSizes = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

/**
 * Calculates the total value of a gem based on carats and base value
 * @param {number} carats - The carat size of the gem
 * @param {number} value - The base value of the gem type
 * @returns {number} The calculated total value
 */
export function calculateGemValue(carats, value) {
  return ((carats * carats) + (4 * carats)) * value;
}

/**
 * Calculates the weight of a gem based on carats
 * @param {number} carats - The carat size of the gem
 * @returns {number} The calculated weight in pounds
 */
export function calculateGemWeight(carats) {
  return (carats / 2488);
}

/**
 * Generates all possible gem combinations with their values
 * @param {Object} customGemValues - Custom gem values (optional)
 * @param {Array} customCaratSizes - Custom carat sizes (optional)
 * @returns {Array} Array of gem combinations sorted by value (highest to lowest)
 */
export function generateGemCombinations(customGemValues = gemValues, customCaratSizes = caratSizes) {
  const combinations = [];
  
  for (const [gemName, baseValue] of Object.entries(customGemValues)) {
    for (const carats of customCaratSizes) {
      const totalValue = calculateGemValue(carats, baseValue);
      const weight = calculateGemWeight(carats);
      
      combinations.push({
        name: gemName,
        carats: carats,
        baseValue: baseValue,
        totalValue: totalValue,
        weight: weight
      });
    }
  }
  
  // Sort by value (highest to lowest)
  return combinations.sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * ALGORITMO CORRETO que respeita tipos de gemas e variedade com intervalo min/max
 * @param {number} targetValue - The target value to achieve
 * @param {Object} customGemValues - Custom gem values (optional)
 * @param {Array} customCaratSizes - Custom carat sizes (optional)
 * @param {number} minGemTypes - Minimum number of different GEM TYPES (not combinations)
 * @param {number} maxGemTypes - Maximum number of different GEM TYPES (not combinations)
 * @param {number} minGemValue - Minimum base value for gem types
 * @param {number} maxGemValue - Maximum base value for gem types
 * @returns {Object} Object containing the optimal gem combination and statistics
 */
export function findOptimalGemBag(targetValue, customGemValues = gemValues, customCaratSizes = caratSizes, minGemTypes = 3, maxGemTypes = null, minGemValue = null, maxGemValue = null) {
  console.log(`🔥 ALGORITMO INICIADO: minGemTypes=${minGemTypes}, maxGemTypes=${maxGemTypes}`);
  
  // Filter valid gem types by value range
  const validGemTypes = Object.entries(customGemValues)
    .filter(([name, value]) => {
      if (minGemValue !== null && value < minGemValue) return false;
      if (maxGemValue !== null && value > maxGemValue) return false;
      return true;
    });
  
  if (validGemTypes.length === 0) {
    return {
      gems: [],
      totalValue: 0,
      totalGemCount: 0,
      targetValue: targetValue,
      difference: targetValue,
      accuracy: '0.0',
      gemTypesUsed: 0,
      uniqueGemTypes: 0,
      caratVarietyUsed: 0,
      error: 'No valid gem types in the specified value range'
    };
  }
  
  // Adjust min/max gem types based on available types
  const effectiveMinGemTypes = Math.min(minGemTypes, validGemTypes.length);
  const effectiveMaxGemTypes = maxGemTypes !== null ? Math.min(maxGemTypes, validGemTypes.length) : validGemTypes.length;
  
  // Validate min/max relationship
  if (effectiveMinGemTypes > effectiveMaxGemTypes) {
    return {
      gems: [],
      totalValue: 0,
      totalGemCount: 0,
      targetValue: targetValue,
      difference: targetValue,
      accuracy: '0.0',
      gemTypesUsed: 0,
      uniqueGemTypes: 0,
      caratVarietyUsed: 0,
      error: `Minimum gem types (${effectiveMinGemTypes}) cannot be greater than maximum gem types (${effectiveMaxGemTypes})`
    };
  }
  
  console.log(`🔥 LIMITES EFETIVOS: Min=${effectiveMinGemTypes}, Max=${effectiveMaxGemTypes}, Tipos disponíveis=${validGemTypes.length}`);
  
  // PASSO 1: Selecionar quantos tipos de gemas usar (entre min e max)
  const numTypesToUse = Math.floor(Math.random() * (effectiveMaxGemTypes - effectiveMinGemTypes + 1)) + effectiveMinGemTypes;
  console.log(`🔥 DECISÃO: Vou usar EXATAMENTE ${numTypesToUse} tipos de gemas (entre ${effectiveMinGemTypes} e ${effectiveMaxGemTypes})`);
  
  // PASSO 2: Selecionar aleatoriamente os tipos de gemas que vamos usar
  const shuffledTypes = [...validGemTypes].sort(() => 0.5 - Math.random());
  const selectedGemTypes = shuffledTypes.slice(0, numTypesToUse);
  console.log(`🔥 TIPOS SELECIONADOS:`, selectedGemTypes.map(([name]) => name));
  
  // PASSO 3: Gerar combinações APENAS para os tipos selecionados
  const selectedGemValues = Object.fromEntries(selectedGemTypes);
  const combinations = generateGemCombinations(selectedGemValues, customCaratSizes)
    .sort((a, b) => a.totalValue - b.totalValue);
  
  console.log(`🔥 COMBINAÇÕES: ${combinations.length} combinações disponíveis dos ${numTypesToUse} tipos selecionados`);
  
  const selectedGems = [];
  let totalBagValue = 0;
  let remainingValue = targetValue;
  
  // Track usage
  const usedGemTypeNames = new Set();
  const gemTypeUsage = new Map();
  const caratUsage = new Map();
  
  // Initialize tracking
  selectedGemTypes.forEach(([name, value]) => {
    gemTypeUsage.set(name, 0);
  });
  customCaratSizes.forEach(carat => {
    caratUsage.set(carat, 0);
  });
  
  while (remainingValue > 0) {
    let selectedGem = null;
    
    // FASE 1: Garantir que usamos todos os tipos selecionados primeiro
    if (usedGemTypeNames.size < numTypesToUse) {
      // Encontrar a gema mais barata de um tipo ainda não usado
      for (const combo of combinations) {
        if (combo.totalValue <= remainingValue && !usedGemTypeNames.has(combo.name)) {
          selectedGem = combo;
          console.log(`🔥 NOVO TIPO: ${combo.name} (${usedGemTypeNames.size + 1}/${numTypesToUse})`);
          break;
        }
      }
    }
    
    // FASE 2: Continuar com os tipos já selecionados (balanceamento)
    if (!selectedGem) {
      let bestScore = Infinity;
      
      for (const combo of combinations) {
        if (combo.totalValue <= remainingValue && usedGemTypeNames.has(combo.name)) {
          const gemTypeUsageCount = gemTypeUsage.get(combo.name) || 0;
          const caratUsageCount = caratUsage.get(combo.carats) || 0;
          
          // Score para balancear uso
          let score = 0;
          score += gemTypeUsageCount * 100;
          score += caratUsageCount * 10;
          score += combo.totalValue * 0.01;
          
          if (score < bestScore) {
            bestScore = score;
            selectedGem = combo;
          }
        }
      }
    }
    
    // FASE 3: Fallback para a menor gema disponível dos tipos selecionados
    if (!selectedGem) {
      for (const combo of combinations) {
        if (combo.totalValue <= remainingValue && usedGemTypeNames.has(combo.name)) {
          selectedGem = combo;
          break;
        }
      }
    }
    
    if (!selectedGem) {
      console.log(`🔥 FIM: Não conseguiu encontrar mais gemas que cabem no valor restante: ${remainingValue}`);
      break;
    }
    
    // Update tracking
    usedGemTypeNames.add(selectedGem.name);
    gemTypeUsage.set(selectedGem.name, (gemTypeUsage.get(selectedGem.name) || 0) + 1);
    caratUsage.set(selectedGem.carats, (caratUsage.get(selectedGem.carats) || 0) + 1);
    
    // Add to selected gems
    const existingGem = selectedGems.find(g => 
      g.name === selectedGem.name && g.carats === selectedGem.carats
    );
    
    if (existingGem) {
      existingGem.quantity += 1;
    } else {
      selectedGems.push({
        ...selectedGem,
        quantity: 1
      });
    }
    
    remainingValue -= selectedGem.totalValue;
    totalBagValue += selectedGem.totalValue;
  }
  
  console.log(`🔥 RESULTADO FINAL: ${usedGemTypeNames.size} tipos únicos usados:`, Array.from(usedGemTypeNames));
  console.log(`🔥 VALIDAÇÃO: Min=${effectiveMinGemTypes}, Max=${effectiveMaxGemTypes}, Usado=${usedGemTypeNames.size}`);
  
  // Calculate statistics
  const totalGemCount = selectedGems.reduce((sum, gem) => sum + gem.quantity, 0);
  const uniqueGemTypes = new Set(selectedGems.map(g => g.name));
  const uniqueCaratSizes = new Set(selectedGems.map(g => g.carats));
  const uniqueGemCombinations = new Set(selectedGems.map(g => `${g.name}-${g.carats}`));
  
  return {
    gems: selectedGems,
    totalValue: totalBagValue,
    totalGemCount: totalGemCount,
    targetValue: targetValue,
    difference: targetValue - totalBagValue,
    accuracy: totalBagValue > 0 ? ((totalBagValue / targetValue) * 100).toFixed(1) : '0.0',
    gemTypesUsed: uniqueGemCombinations.size,
    uniqueGemTypes: uniqueGemTypes.size,
    caratVarietyUsed: uniqueCaratSizes.size,
    caratSizesUsed: Array.from(uniqueCaratSizes).sort((a, b) => a - b),
    gemTypeNames: Array.from(uniqueGemTypes).sort(),
    minGemTypesRequired: minGemTypes,
    maxGemTypesAllowed: maxGemTypes,
    actualGemTypesUsed: numTypesToUse,
    validGemTypesAvailable: validGemTypes.length,
    minGemValue,
    maxGemValue
  };
}