import { startTestDB, stopTestDB } from '../../testDB.js';
import Recipe from '../../../models/Recipe.js';
import User from '../../../models/User.js';

describe('Recipe Model', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  afterEach(async () => {
    await Recipe.deleteMany({});
    await User.deleteMany({});
  });

  describe('schema validation', () => {
    it('creates a recipe with valid fields', async () => {
      const user = await User.create({
        name: 'Chef',
        email: 'chef@test.com',
        password: 'password123',
      });
      const recipe = await Recipe.create({
        title: 'Pasta',
        description: 'Simple pasta',
        ingredients: ['Pasta', 'Tomato'],
        steps: ['Boil', 'Serve'],
        category: 'Main',
        diet: 'vegetarian',
        createdBy: user._id,
      });
      expect(recipe.title).toBe('Pasta');
      expect(recipe.diet).toBe('vegetarian');
      expect(String(recipe.createdBy)).toBe(String(user._id));
    });

    it('requires a title', async () => {
      const user = await User.create({
        name: 'Chef',
        email: 'chef2@test.com',
        password: 'password123',
      });
      await expect(
        Recipe.create({
          ingredients: ['A'],
          steps: ['B'],
          category: 'Main',
          createdBy: user._id,
        })
      ).rejects.toThrow();
    });

    it('allows a recipe with empty ingredients and steps (arrays)', async () => {
      const user = await User.create({
        name: 'Chef',
        email: 'chef3@test.com',
        password: 'password123',
      });
      const recipe = await Recipe.create({
        title: 'NoStuff',
        category: 'Main',
        createdBy: user._id,
      });
      expect(recipe.title).toBe('NoStuff');
      expect(Array.isArray(recipe.ingredients)).toBe(true);
      expect(Array.isArray(recipe.steps)).toBe(true);
    });

    it('rejects invalid diet value', async () => {
      const user = await User.create({
        name: 'Chef',
        email: 'chef4@test.com',
        password: 'password123',
      });
      await expect(
        Recipe.create({
          title: 'BadDiet',
          ingredients: ['A'],
          steps: ['B'],
          category: 'Main',
          diet: 'not-a-diet',
          createdBy: user._id,
        })
      ).rejects.toThrow();
    });

    it('defaults diet to none when not provided', async () => {
      const user = await User.create({
        name: 'Chef',
        email: 'chef5@test.com',
        password: 'password123',
      });
      const recipe = await Recipe.create({
        title: 'Default Diet',
        ingredients: ['A'],
        steps: ['B'],
        category: 'Soup',
        createdBy: user._id,
      });
      expect(recipe.diet).toBe('none');
    });

    it('generates a slug from the title', async () => {
      const user = await User.create({
        name: 'Chef',
        email: 'chef6@test.com',
        password: 'password123',
      });
      const recipe = await Recipe.create({
        title: 'Vegan Stew',
        description: 'Hearty',
        ingredients: ['Lentils'],
        steps: ['Simmer'],
        category: 'Main',
        createdBy: user._id,
      });
      expect(recipe.slug).toBe('vegan-stew');
    });

    it('keeps duplicate title slugs unique', async () => {
      const user = await User.create({
        name: 'Chef',
        email: 'chef7@test.com',
        password: 'password123',
      });
      const base = {
        ingredients: ['A'],
        steps: ['B'],
        category: 'Main',
        createdBy: user._id,
      };
      const first = await Recipe.create({ title: 'Pasta', ...base });
      const second = await Recipe.create({ title: 'Pasta', ...base });
      expect(first.slug).toBe('pasta');
      expect(second.slug).toBe('pasta-1');
    });
  });
});
