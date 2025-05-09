const express = require('express');
const { body, validationResult } = require('express-validator');
const Activity = require('../models/activity.model');
const { auth, adminAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Get all activities
router.get('/', async (req, res) => {
  try {
    const activities = await Activity.find({ isActive: true });
    const formatted = activities.map(a => ({
      id: a._id,
      title: a.title,
      description: a.description,
      location: a.location,
      date: a.schedule[0]?.date,
      time: a.schedule[0] ? `${a.schedule[0].startTime} - ${a.schedule[0].endTime}` : null
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activities', error: error.message });
  }
});

// Get single activity
router.get('/:id', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activity', error: error.message });
  }
});

// Create new activity (admin only)
router.post('/',
  adminAuth,
  [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required')
      .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    body('price')
      .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('duration')
      .isInt({ min: 15 }).withMessage('Duration must be at least 15 minutes'),
    body('capacity')
      .isInt({ min: 1, max: 100 }).withMessage('Capacity must be between 1 and 100'),
    body('location')
      .trim()
      .notEmpty().withMessage('Location is required')
      .isLength({ min: 3, max: 200 }).withMessage('Location must be between 3 and 200 characters'),
    body('schedule').isArray().withMessage('Schedule must be an array'),
    body('schedule.*.date')
      .isISO8601().withMessage('Valid date is required'),
    body('schedule.*.startTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time is required (HH:MM format)'),
    body('schedule.*.endTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid end time is required (HH:MM format)'),
    body('schedule.*.availableSpots')
      .isInt({ min: 0 }).withMessage('Available spots must be a non-negative number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const activity = new Activity(req.body);
      await activity.save();
      res.status(201).json(activity);
    } catch (error) {
      res.status(500).json({ message: 'Error creating activity', error: error.message });
    }
  }
);

// Update activity (admin only)
router.put('/:id',
  adminAuth,
  [
    body('title')
      .optional()
      .trim()
      .notEmpty().withMessage('Title cannot be empty')
      .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .notEmpty().withMessage('Description cannot be empty')
      .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    body('price')
      .optional()
      .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('duration')
      .optional()
      .isInt({ min: 15 }).withMessage('Duration must be at least 15 minutes'),
    body('capacity')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Capacity must be between 1 and 100'),
    body('location')
      .optional()
      .trim()
      .notEmpty().withMessage('Location cannot be empty')
      .isLength({ min: 3, max: 200 }).withMessage('Location must be between 3 and 200 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const activity = await Activity.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!activity) {
        return res.status(404).json({ message: 'Activity not found' });
      }

      res.json(activity);
    } catch (error) {
      res.status(500).json({ message: 'Error updating activity', error: error.message });
    }
  }
);

// Delete activity (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const activity = await Activity.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting activity', error: error.message });
  }
});

module.exports = router; 