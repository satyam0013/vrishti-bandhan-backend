require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/vrishti", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,      // from .env
    pass: process.env.EMAIL_PASS       // from .env
  }
});

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String // 'farmer' or 'company'
});

const wasteSchema = new mongoose.Schema({
  title: String,
  description: String,
  quantity: Number,
  location: String,
  contact: String,
  farmerId: String
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Waste = mongoose.model("Waste", wasteSchema);

// ROUTES

// Registration route
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashed, role });
    await newUser.save();
    res.json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    res.json({ message: "Login successful", user });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Post Waste + Notify Companies
app.post("/api/wastes", async (req, res) => {
  try {
    const { title, description, quantity, location, contact, farmerId } = req.body;
    const newWaste = new Waste({ title, description, quantity, location, contact, farmerId });
    await newWaste.save();

    // Notify all company users by email
    const companies = await User.find({ role: 'company' });

    companies.forEach(company => {
      console.log(`📨 Attempting to send to: ${company.email}`);

      transporter.sendMail({
        from: `"Vrishti Bandhan" <${process.env.EMAIL_USER}>`,
        to: company.email,
        subject: "New Agricultural Waste Posted",
        html: `
          <p>Hello ${company.name},</p>
          <p>A new waste has been posted:</p>
          <ul>
            <li><strong>Title:</strong> ${newWaste.title}</li>
            <li><strong>Quantity:</strong> ${newWaste.quantity} kg</li>
            <li><strong>Location:</strong> ${newWaste.location}</li>
            <li><strong>Contact:</strong> ${newWaste.contact}</li>
          </ul>
          <p>Visit your dashboard to respond.</p>
        `
      }, (err, info) => {
        if (err) {
          console.error(`❌ Email error to ${company.email}:`, err);
        } else {
          console.log(`✅ Email sent to ${company.email}`);
        }
      });
    });

    res.status(201).json({ message: "Waste posted and emails sent!" });
  } catch (err) {
    console.error("❌ Waste post error:", err);
    res.status(400).json({ error: "Failed to post waste" });
  }
});

// Get all or farmer-specific wastes
app.get("/api/wastes", async (req, res) => {
  try {
    const filter = {};
    if (req.query.farmerId) {
      filter.farmerId = req.query.farmerId;
    }
    const wastes = await Waste.find(filter).sort({ createdAt: -1 });
    res.json(wastes);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch wastes" });
  }
});

// Update waste
app.put("/api/wastes/:id", async (req, res) => {
  try {
    await Waste.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: "Waste updated successfully" });
  } catch (err) {
    res.status(400).json({ error: "Failed to update waste" });
  }
});

// Delete waste
app.delete("/api/wastes/:id", async (req, res) => {
  try {
    const deleted = await Waste.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Waste not found" });

    res.json({ message: "Waste deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete waste" });
  }
});

// Root route
app.get("/", (req, res) => {
  res.send("🌿 Vrishti Bandhan backend is running!");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
