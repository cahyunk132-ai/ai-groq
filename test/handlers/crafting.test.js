import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { CraftingHandler } from '../../src/handlers/crafting.js';

test('CraftingHandler resolves simple crafting recipes', async () => {
  let craftedRecipe = null;
  const mockRecipe = { id: 101, requiresTable: false };

  const fakeBot = {
    registry: {
      itemsByName: {
        stick: { id: 101 },
      },
    },
    recipesFor: (id, table) => [mockRecipe],
    craft: async (recipe, count, table) => {
      craftedRecipe = { recipe, count, table };
    },
  };

  const handler = new CraftingHandler(fakeBot, { log: () => {} });
  const success = await handler.craftSimple('stick', 4);

  assert.equal(success, true);
  assert.equal(craftedRecipe?.recipe?.id, 101);
  assert.equal(craftedRecipe?.count, 4);
  assert.equal(craftedRecipe?.table, null);
});

test('CraftingHandler finds crafting table in world', async () => {
  const fakeBot = {
    registry: {
      blocksByName: {
        crafting_table: { id: 58 },
      },
    },
    findBlocks: () => [new Vec3(2, 64, 0)],
    blockAt: (pos) => ({ name: 'crafting_table', position: pos }),
  };

  const handler = new CraftingHandler(fakeBot, { log: () => {} });
  const table = await handler.findCraftingTable(16);

  assert.ok(table);
  assert.equal(table.name, 'crafting_table');
  assert.equal(table.position.x, 2);
});
