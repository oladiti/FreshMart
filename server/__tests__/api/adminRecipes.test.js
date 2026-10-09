import {
  setupApiTest,
  teardownApiTest,
  agent,
  generateToken,
  seedUsers,
  seedRecipe,
  getAdminDoc,
  getUserDoc,
} from './apiSetup.js';

describe('Admin Recipes API', () => {
  beforeAll(async () => {
    await setupApiTest();
  });

  afterAll(async () => {
    await teardownApiTest();
  });

  const adminAuth = async () => {
    await seedUsers();
    const admin = await getAdminDoc();
    return generateToken(admin._id, admin.role);
  };

  const userAuth = async () => {
    await seedUsers();
    const user = await getUserDoc();
    return generateToken(user._id, user.role);
  };

  describe('GET /api/admin/recipes', () => {
    it('returns recipes for an admin', async () => {
      const token = await adminAuth();
      const user = await getUserDoc();
      await seedRecipe(user._id);
      const res = await agent()
        .get('/api/admin/recipes')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/admin/recipes', () => {
    it('creates a recipe for an admin', async () => {
      const token = await adminAuth();
      const res = await agent()
        .post('/api/admin/recipes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Admin Recipe',
          ingredients: ['A'],
          steps: ['B'],
          category: 'Soup',
          diet: 'vegan',
          image: '/images/recipe-admin.jpg',
        });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Admin Recipe');
      expect(res.body.image).toBe('/images/recipe-admin.jpg');
    });
  });

  describe('PUT /api/admin/recipes/:id', () => {
    it('updates a recipe image for an admin', async () => {
      const token = await adminAuth();
      const user = await getUserDoc();
      const recipe = await seedRecipe(user._id);
      const res = await agent()
        .put(`/api/admin/recipes/${recipe._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ image: '/images/recipe-jollof-rice.jpg' });
      expect(res.status).toBe(200);
      expect(res.body.image).toBe('/images/recipe-jollof-rice.jpg');
    });

    it('returns 404 for a recipe that does not exist', async () => {
      const token = await adminAuth();
      const res = await agent()
        .put('/api/admin/recipes/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ image: '/images/recipe-missing.jpg' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/recipes/:id', () => {
    it('deletes a recipe for an admin', async () => {
      const token = await adminAuth();
      const user = await getUserDoc();
      const recipe = await seedRecipe(user._id);
      const res = await agent()
        .delete(`/api/admin/recipes/${recipe._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      const check = await agent().get(`/api/recipes/${recipe._id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for a recipe that does not exist', async () => {
      const token = await adminAuth();
      const res = await agent()
        .delete('/api/admin/recipes/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('authorization guards', () => {
    it('rejects a regular user with 403', async () => {
      const token = await userAuth();
      const res = await agent()
        .get('/api/admin/recipes')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('rejects a request with no token with 401', async () => {
      const res = await agent().get('/api/admin/recipes');
      expect(res.status).toBe(401);
    });
  });
});
