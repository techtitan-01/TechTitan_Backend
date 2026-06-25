import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// Helper to create generic CRUD routes
const makeCrudRoutes = (router, path, tableName) => {
  // GET all
  router.get(path, async (req, res) => {
    try {
      const { data, error } = await supabase.from(tableName).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST new
  router.post(path, async (req, res) => {
    try {
      const { data, error } = await supabase.from(tableName).insert([req.body]).select();
      if (error) throw error;
      res.status(201).json(data[0]);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT update
  router.put(`${path}/:id`, async (req, res) => {
    try {
      const { data, error } = await supabase.from(tableName).update(req.body).eq('id', req.params.id).select();
      if (error) throw error;
      if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(data[0]);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE
  router.delete(`${path}/:id`, async (req, res) => {
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};

// Create standard CRUD
makeCrudRoutes(router, '/modules', 'modules');
makeCrudRoutes(router, '/events', 'events');
makeCrudRoutes(router, '/doubts', 'doubts');
makeCrudRoutes(router, '/members', 'members');

// Custom routes for Blogs to handle History
router.get('/blogs', async (req, res) => {
  try {
    const { data, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/blogs', async (req, res) => {
  try {
    const allowedFields = ['title', 'content', 'author', 'imageUrl', 'mediaUrl'];
    const filteredBody = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) filteredBody[key] = req.body[key];
    }
    const blogData = { ...filteredBody, date: new Date().toISOString().split('T')[0] };
    
    const { data, error } = await supabase.from('blogs').insert([blogData]).select();
    if (error) {
      console.error('Supabase Insert Error:', error);
      throw error;
    }
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message, details: err });
  }
});

router.put('/blogs/:id', async (req, res) => {
  try {
    const { data: oldBlog, error: fetchError } = await supabase.from('blogs').select('*').eq('id', req.params.id).single();
    if (fetchError || !oldBlog) return res.status(404).json({ error: 'Not found' });
    
    // Save current state to history
    const historyEntry = {
      title: oldBlog.title,
      content: oldBlog.content,
      mediaUrl: oldBlog.mediaUrl || oldBlog.imageUrl,
      updatedBy: req.body.author || 'System',
      savedAt: new Date().toISOString()
    };
    
    let currentHistory = oldBlog.history || [];
    if (!Array.isArray(currentHistory)) currentHistory = [];
    currentHistory.push(historyEntry);
    
    // Filter allowed fields
    const allowedFields = ['title', 'content', 'author', 'imageUrl', 'mediaUrl'];
    const filteredBody = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) filteredBody[key] = req.body[key];
    }
    
    // Set up update data
    const updateData = { ...filteredBody, history: currentHistory };
    
    // Update fields and push to history
    const { data, error } = await supabase.from('blogs').update(updateData).eq('id', req.params.id).select();
    if (error) throw error;
    
    res.json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Restore blog from history (simple implementation)
router.post('/blogs/:id/restore/:historyIdx', async (req, res) => {
  try {
    const { data: blog, error: fetchError } = await supabase.from('blogs').select('*').eq('id', req.params.id).single();
    if (fetchError || !blog) return res.status(404).json({ error: 'Not found' });
    
    const historyEntry = blog.history[req.params.historyIdx];
    if (!historyEntry) return res.status(404).json({ error: 'History not found' });
    
    // Create new history entry for current state before restoring
    let currentHistory = blog.history || [];
    currentHistory.push({
      title: blog.title,
      content: blog.content,
      mediaUrl: blog.mediaUrl || blog.imageUrl,
      updatedBy: 'Restored',
      savedAt: new Date().toISOString()
    });
    
    const updateData = {
      title: historyEntry.title,
      content: historyEntry.content,
      imageUrl: historyEntry.mediaUrl,
      mediaUrl: historyEntry.mediaUrl,
      history: currentHistory
    };
    
    const { data, error } = await supabase.from('blogs').update(updateData).eq('id', req.params.id).select();
    if (error) throw error;
    
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/blogs/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('blogs').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
