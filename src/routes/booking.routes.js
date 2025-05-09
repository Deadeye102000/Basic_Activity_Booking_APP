const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/booking.model');
const Activity = require('../models/activity.model');
const { auth, adminAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Get all bookings (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user', 'name email')
      .populate('activity', 'title');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
});

// Get user's bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('activity', 'title description location schedule');
    const activities = bookings.map(b => ({
      id: b.activity._id,
      title: b.activity.title,
      description: b.activity.description,
      location: b.activity.location,
      date: b.activity.schedule[0]?.date,
      time: b.activity.schedule[0] ? `${b.activity.schedule[0].startTime} - ${b.activity.schedule[0].endTime}` : null
    }));
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
});

// Create new booking
router.post('/',
  auth,
  [
    body('activityId').notEmpty().withMessage('Activity ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { activityId } = req.body;

      // Check if activity exists and is active
      const activity = await Activity.findOne({ _id: activityId, isActive: true });
      if (!activity) {
        return res.status(404).json({ message: 'Activity not found or inactive' });
      }

      // Book the first available schedule slot
      const scheduleSlot = activity.schedule.find(slot => slot.availableSpots > 0);
      if (!scheduleSlot) {
        return res.status(400).json({ message: 'No available slots for this activity' });
      }

      // Calculate total price (1 participant)
      const totalPrice = activity.price;

      // Create booking
      const booking = new Booking({
        user: req.user._id,
        activity: activityId,
        schedule: {
          date: scheduleSlot.date,
          startTime: scheduleSlot.startTime,
          endTime: scheduleSlot.endTime
        },
        numberOfParticipants: 1,
        totalPrice
      });

      await booking.save();

      // Update available spots
      scheduleSlot.availableSpots -= 1;
      await activity.save();

      res.status(201).json({
        message: 'Activity booked successfully',
        booking
      });
    } catch (error) {
      res.status(500).json({ message: 'Error creating booking', error: error.message });
    }
  }
);

// Cancel booking
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    // Update booking status
    booking.status = 'cancelled';
    booking.paymentStatus = 'refunded';
    await booking.save();

    // Update available spots
    const activity = await Activity.findById(booking.activity);
    const scheduleSlot = activity.schedule.find(slot => 
      slot.date.toISOString() === booking.schedule.date.toISOString() &&
      slot.startTime === booking.schedule.startTime &&
      slot.endTime === booking.schedule.endTime
    );

    if (scheduleSlot) {
      scheduleSlot.availableSpots += booking.numberOfParticipants;
      await activity.save();
    }

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling booking', error: error.message });
  }
});

// Update booking status (admin only)
router.patch('/:id/status',
  adminAuth,
  [
    body('status').isIn(['pending', 'confirmed', 'cancelled']).withMessage('Invalid status'),
    body('paymentStatus').isIn(['pending', 'paid', 'refunded']).withMessage('Invalid payment status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const booking = await Booking.findByIdAndUpdate(
        req.params.id,
        {
          status: req.body.status,
          paymentStatus: req.body.paymentStatus
        },
        { new: true }
      );

      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      res.json(booking);
    } catch (error) {
      res.status(500).json({ message: 'Error updating booking status', error: error.message });
    }
  }
);

module.exports = router; 