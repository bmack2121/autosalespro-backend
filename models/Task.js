import mongoose from "mongoose";

const SubtaskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  done: { type: Boolean, default: false }
});

const TaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      index: true
    },

    text: { type: String, required: true },

    category: {
      type: String,
      enum: ["Sales", "Inventory", "Finance", "Admin", "Follow-up"],
      required: true
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      required: true
    },

    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Cancelled"],
      default: "Pending"
    },

    dueDate: { type: Date, required: true },

    notes: { type: String, default: "" },

    subtasks: [SubtaskSchema]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ⭐ VIRTUAL: Check if Task is Overdue
TaskSchema.virtual("isOverdue").get(function () {
  return this.status !== "Completed" && this.dueDate < new Date();
});

// ⭐ MIDDLEWARE: Auto-update status based on subtasks
TaskSchema.pre("save", function (next) {
  if (this.subtasks.length > 0) {
    const allDone = this.subtasks.every(st => st.done);
    const someDone = this.subtasks.some(st => st.done);

    if (allDone) {
      this.status = "Completed";
    } else if (someDone) {
      this.status = "In Progress";
    }
  }
  next();
});

// Optimized Indexing for the "Focus" Widget
TaskSchema.index({ user: 1, status: 1, dueDate: 1 });
TaskSchema.index({ dueDate: 1, status: 1 });

export default mongoose.model("Task", TaskSchema);