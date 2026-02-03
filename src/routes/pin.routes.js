import express from "express";
import jwt from "jsonwebtoken";
import Pin from "../models/Pin.js";
import { config } from "../config/config.js";
import bcrypt from "bcrypt";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();


router.post("/create-pin", async (req, res) => {
  const { pin } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({ message: "Invalid PIN" });
  }

  const existingPin = await Pin.findOne();
  if (existingPin) {
    return res.status(400).json({ message: "PIN already exists" });
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const user = await Pin.create({ pinHash });

  const token = jwt.sign(
    { userId: user._id },
    config.jwtSecret,
    { expiresIn: "1d" }
  );
  res.status(201).json({ message: "PIN created successfully", token });
});

router.post("/confirm-pin", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ message: "PIN is required" });
    }

    const users = await Pin.find();

    if (!users.length) {
      return res.status(400).json({ message: "No PIN found" });
    }

    let matchedUser = null;

    for (let user of users) {
      const match = await bcrypt.compare(pin, user.pinHash);
      if (match) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(400).json({ message: "Wrong PIN" });
    }

    const token = jwt.sign(
      { userId: matchedUser._id }, // 🔥 VERY IMPORTANT
      config.jwtSecret,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      success: true,
      token,
      message: "PIN confirmed successfully",
    });

  } catch (error) {
    console.error("CONFIRM PIN ERROR", error);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/exists", async (req, res) => {
  const pin = await Pin.findOne();
  res.json({ exists: Boolean(pin) });
});

router.post("/forgot-pin", async (req, res) => {
  await Pin.deleteMany();
  res.json({ message: "PIN deleted permanently" });
});


export default router;
