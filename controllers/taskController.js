import Task from "../models/Task.js";
import Activity from "../models/Activity.js";

// ⭐ GET: Focused Task List
export const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id })
      .populate("customer", "firstName lastName phone")
      .populate("vehicle", "year make model stockNumber")
      .sort({ dueDate: 1, priority: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({
      message: "Failed to load tasks",
      error: err.message
    });
  }
};

// ⭐ CREATE: New Sales Action
export const createTask = async (req, res) => {
  try {
    const {
      text,
      category,
      priority,
      dueDate,
      notes,
      subtasks,
      customer,
      vehicle
    } = req.body;

    const task = await Task.create({
      user: req.user.id,
      customer,
      vehicle,
      text,
      category: category || "TASK",
      priority: priority || "medium",
      dueDate,
      notes: notes || "",
      subtasks: subtasks || [],
      status: "Pending"
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({
      message: "Failed to create task",
      error: err.message
    });
  }
};

// ⭐ UPDATE: Task Progress & Activity Sync
export const updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("customer vehicle");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Log Activity on Completion
    if (req.body.status === "Completed") {
      await Activity.create({
        category: "TASK",
        type: "TASK_COMPLETED",
        message: `Goal Achieved: ${task.text}`,
        user: req.user.id,
        customer: task.customer ? task.customer._id : null,
        inventory: task.vehicle ? task.vehicle._id : null,
        level: "success"
      });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({
      message: "Update sync failed",
      error: err.message
    });
  }
};

// ⭐ DELETE: Remove from Workspace
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!task) {
      return res.status(404).json({
        message: "Authorization error or task missing"
      });
    }

    res.json({
      success: true,
      message: "Task purged from lot workspace"
    });
  } catch (err) {
    res.status(500).json({ message: "Deletion failed" });
  }
};