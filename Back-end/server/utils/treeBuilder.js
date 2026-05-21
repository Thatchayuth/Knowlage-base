'use strict';
/**
 * treeBuilder.js
 * ──────────────
 * Pure utility — converts flat folder array into a nested tree structure,
 * and filters the tree based on AD group permissions.
 *
 * Called by : folder.service.js
 * Depends on: nothing (pure functions, no I/O)
 *
 * Exported functions:
 *   buildTree(items, parentId)
 *     → Recursive: groups children under each parent node.
 *
 *   filterTreeByPermission(tree, userGroups, permMap)
 *     → Keeps nodes where user has CanView, OR any descendant has CanView
 *       (so parent folders are shown for navigation context).
 *
 *   flattenTree(tree)
 *     → Breadth-first flatten of a nested tree back to a flat list.
 */

/**
 * Build nested tree from a flat array.
 *
 * @param {Array<Object>} items     - flat folder records with {id, parentId, ...}
 * @param {number|null}   parentId  - root parentId (null = top-level)
 * @returns {Array<Object>} nested tree
 *
 * Example input:
 *   [ {id:1, parentId:null, name:'HR'}, {id:2, parentId:1, name:'Salary'} ]
 * Example output:
 *   [ {id:1, name:'HR', children:[{id:2, name:'Salary', children:[]}]} ]
 */
function buildTree(items, parentId = null) {
  return items
    .filter(item => item.parentId === parentId || item.ParentId === parentId)
    .map(item => ({
      ...item,
      children: buildTree(items, item.id || item.Id),
    }));
}

/**
 * Filter tree — keep only folders reachable by this user.
 *
 * Permission inheritance rules:
 *   1. If folder has EXPLICIT permissions in permMap → use those (override).
 *   2. If folder has NO explicit permissions → inherit from nearest ancestor
 *      that has explicit permissions (passed down as inheritedGroups).
 *   3. If neither the folder nor any ancestor has permissions → deny (empty = deny).
 *
 * Visibility rules:
 *   - A folder is SHOWN only when the user has effective access
 *     (own perms OR inherited from an ancestor).
 *   - A folder is NOT shown just because a descendant has permissions.
 *   - When a folder is hidden (no effective access) but a child IS visible,
 *     the child is HOISTED up to the hidden folder's position in the tree —
 *     so the child still appears without its inaccessible parent.
 *
 * Examples:
 *   HR (perms) → All-BU (no perms) : both show  (All-BU inherits from HR)
 *   HR (none)  → All-BU (no perms) : neither show
 *   HR (none)  → All-BU (perms)    : only All-BU shows, hoisted to HR's level
 *
 * @param {Array<Object>}        tree            - nested tree (output of buildTree)
 * @param {string[]}             userGroups      - lowercase AD group names for current user
 * @param {Map<number,string[]>} permMap         - Map<folderId → [adGroupLower, ...]>
 * @param {string[]}             inheritedGroups - groups inherited from nearest ancestor (internal)
 * @returns {Array<Object>} filtered tree
 */
function filterTreeByPermission(tree, userGroups, permMap, inheritedGroups = []) {
  const result = [];
  const lowerGroups = userGroups.map(g => g.toLowerCase());

  for (const node of tree) {
    const nodeId = node.id || node.Id;

    // undefined = no explicit entry in permMap (folder has no direct permission set)
    const directPerms = permMap.has(nodeId) ? permMap.get(nodeId) : undefined;

    // Effective groups: own perms override inherited; otherwise use inherited from parent
    const effectiveGroups = directPerms !== undefined ? directPerms : inheritedGroups;

    // Access = user's groups intersect effectiveGroups (empty effectiveGroups = deny)
    const hasEffectiveAccess = effectiveGroups.length > 0
      && effectiveGroups.some(g => lowerGroups.includes(g));

    // Groups to pass to children:
    //   - If this folder has own perms → propagate those down
    //   - Otherwise → continue propagating what we inherited from above
    const nextInherited = directPerms !== undefined ? directPerms : inheritedGroups;

    const filteredChildren = filterTreeByPermission(
      node.children || [],
      userGroups,
      permMap,
      nextInherited
    );

    if (hasEffectiveAccess) {
      // Folder is accessible → include it with all its visible children
      result.push({
        ...node,
        _hasDirectAccess: hasEffectiveAccess,  // hint for UI rendering
        children: filteredChildren,
      });
    } else {
      // Folder is NOT accessible → do NOT show it,
      // but HOIST any visible children up to this folder's position
      // so that child folders with their own permissions still appear.
      result.push(...filteredChildren);
    }
  }
  return result;
}

/**
 * Flatten nested tree to a flat list (breadth-first).
 * Useful for lookups, permission map building, etc.
 *
 * @param {Array<Object>} tree
 * @returns {Array<Object>}
 */
function flattenTree(tree) {
  const result = [];
  const queue  = [...tree];
  while (queue.length) {
    const node = queue.shift();
    result.push(node);
    if (node.children?.length) queue.push(...node.children);
  }
  return result;
}

/**
 * Collect all ancestor ids for a given node id in a flat list.
 * Used to auto-expand sidebar path on folder navigation.
 *
 * @param {number}   targetId
 * @param {Array}    flatItems - flat list with {id, parentId}
 * @returns {number[]} array of ancestor ids (nearest first)
 */
function getAncestorIds(targetId, flatItems) {
  const ancestors = [];
  const map = Object.fromEntries(flatItems.map(f => [f.id || f.Id, f]));
  let current = map[targetId];
  while (current) {
    const pid = current.parentId || current.ParentId;
    if (pid == null) break;
    ancestors.push(pid);
    current = map[pid];
  }
  return ancestors;
}

module.exports = { buildTree, filterTreeByPermission, flattenTree, getAncestorIds };
