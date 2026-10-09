import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedUsers,
  seedRecipe,
  getUserDoc,
} from './apiSetup.js';
import Recipe from '../../models/Recipe.js';
import { backfillMissingRecipeSlugs } from '../../backfill-slugs.js';

describe('Recipes API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  describe('GET /api/recipes', () => {
    it('returns a list of recipes', async () => {
      await seedUsers();
      const user = await getUserDoc();
      await seedRecipe(user._id);
      const res = await agent().get('/api/recipes');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/recipes/:slug', () => {
    it('returns a single recipe by slug', async () => {
      const user = await getUserDoc();
      const recipe = await seedRecipe(user._id);
      const res = await agent().get(`/api/recipes/${recipe.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Test Jollof');
      expect(res.body.slug).toBe(recipe.slug);
    });

    it('redirects an id-based URL to the canonical slug', async () => {
      const user = await getUserDoc();
      const recipe = await seedRecipe(user._id);
      const res = await agent()
        .get(`/api/recipes/${recipe._id}`)
        .redirects(0);
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe(`/api/recipes/${recipe.slug}`);
    });

    it('backfills a slug for recipes inserted without one', async () => {
      const user = await getUserDoc();
      await Recipe.updateOne(
        { title: 'Slugless Stew' },
        {
          $setOnInsert: {
            title: 'Slugless Stew',
            ingredients: ['A'],
            steps: ['B'],
            category: 'Main',
            createdBy: user._id,
          },
        },
        { upsert: true }
      );
      const bare = await Recipe.findOne({ title: 'Slugless Stew' });
      expect(bare.slug).toBeUndefined();

      const updated = await backfillMissingRecipeSlugs();
      expect(updated).toBeGreaterThanOrEqual(1);

      const withSlug = await Recipe.findOne({ title: 'Slugless Stew' });
      expect(withSlug.slug).toBe('slugless-stew');

      const res = await agent().get(`/api/recipes/${withSlug.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Slugless Stew');
    });

    it('returns 404 for a recipe that does not exist', async () => {
      const res = await agent().get('/api/recipes/507f1f77bcf86cd799439011');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/recipes', () => {
    it('creates a recipe when authenticated', async () => {
      const user = await getUserDoc();
      const token = generateToken(user._id, user.role);
      const res = await agent()
        .post('/api/recipes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'My New Recipe',
          ingredients: ['A', 'B'],
          steps: ['S1'],
          category: 'Soup',
          diet: 'vegan',
        });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('My New Recipe');
      expect(res.body.diet).toBe('vegan');
    });

    it('returns 401 without a token', async () => {
      const res = await agent().post('/api/recipes').send({
        title: 'No Auth Recipe',
        ingredients: ['A'],
        steps: ['B'],
        category: 'Soup',
      });
      expect(res.status).toBe(401);
    });
  });
});
