/**
 * @file Utility functions for the GURPS Instant Bazaar module
 * @description Common utility functions used across multiple files
 */

/**
 * Recursively flattens items from GURPS equipment structure
 * @param {Object} obj - The equipment object to flatten
 * @returns {Array} Array of flattened items
 */
export function flattenItemsFromObject(obj) {
  const items = [];
  if (typeof obj !== "object" || obj === null) return items;
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === "object" && value !== null) {
        if (value.name !== undefined) {
          // This is an item
          items.push({ id: key, data: value });
          
          // Check for nested items in collapsed property
          if (value.collapsed && typeof value.collapsed === "object") {
            const nestedItems = flattenItemsFromObject(value.collapsed);
            items.push(...nestedItems);
          }
        } else {
          // This might be a container, recurse into it
          items.push(...flattenItemsFromObject(value));
        }
      }
    }
  }
  return items;
}

/**
 * Recursively finds an item in the carried equipment structure
 * @param {Object} carried - The carried equipment object
 * @param {string} itemId - The item ID to find
 * @param {string} [currentPath=''] - Current path in the structure
 * @returns {string|null} The path to the item or null if not found
 */
export function findItemInCarried(carried, itemId, currentPath = '') {
  for (const [key, value] of Object.entries(carried)) {
    const path = currentPath ? `${currentPath}.${key}` : key;
    
    if (key === itemId) {
      return path;
    }
    
    if (value && typeof value === 'object' && value.collapsed) {
      const nestedPath = findItemInCarried(value.collapsed, itemId, `${path}.collapsed`);
      if (nestedPath) return nestedPath;
    }
  }
  return null;
}

/**
 * Gets an item from a path in the carried equipment structure
 * @param {Object} carried - The carried equipment object
 * @param {string} path - The path to the item
 * @returns {Object|null} The item data or null if not found
 */
export function getItemFromPath(carried, path) {
  const pathParts = path.split('.');
  let current = carried;
  
  for (const part of pathParts) {
    if (current && typeof current === 'object' && current[part] !== undefined) {
      current = current[part];
    } else {
      return null;
    }
  }
  
  return current;
}