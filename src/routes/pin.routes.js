import express from "express";
import jwt from "jsonwebtoken";
import Pin from "../models/Pin.js";
import { config } from "../config/config.js";
import bcrypt from "bcrypt";


const router = express.Router();

/* CREATE PIN */
router.post("/create-pin", async (req, res) => {
  const { pin } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({ message: "Invalid PIN" });
  }

  await Pin.deleteMany(); // only one active PIN
  await Pin.create({ pin: String(pin) });

  res.status(201).json({ message: "PIN created successfully" });
});

// router.post("/create-pin", async (req, res) => {
//   const { pin } = req.body;

//   if (!pin || pin.length !== 4) {
//     return res.status(400).json({ message: "Invalid PIN" });
//   }

//   const existingPin = await Pin.findOne();
//   if (existingPin) {
//     return res.status(400).json({ message: "PIN already exists" });
//   }

//   const pinHash = await bcrypt.hash(pin, 10);
//   await Pin.create({ pinHash });

//   res.json({ message: "PIN created" });
// });


/* CONFIRM PIN */
router.post("/confirm-pin", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ message: "PIN is required" });
    }

    // ✅ latest PIN uthao
    const savedPin = await Pin.findOne().sort({ createdAt: -1 });

    if (!savedPin) {
      return res.status(400).json({ message: "No PIN found. Create PIN first." });
    }

    // ❌ agar string vs number mismatch ho raha ho
    if (String(savedPin.pin) !== String(pin)) {
      return res.status(400).json({ message: "PIN mismatch" });
    }

    const token = jwt.sign(
      { pinId: savedPin._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      success: true,
      token,
      message: "PIN confirmed successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// router.post("/confirm-pin", async (req, res) => {
//   const { pin } = req.body;

//   const savedPin = await Pin.findOne();
//   if (!savedPin) {
//     return res.status(400).json({ message: "PIN not found" });
//   }

//   const match = await bcrypt.compare(pin, savedPin.pinHash);
//   if (!match) {
//     return res.status(400).json({ message: "Wrong PIN" });
//   }

//   const token = jwt.sign(
//     { pinId: savedPin._id },
//     process.env.JWT_SECRET,
//     { expiresIn: "1d" }
//   );

//   res.json({ token });
// });


router.get("/exists", async (req, res) => {
  const pin = await Pin.findOne();
  res.json({ exists: Boolean(pin) });
});

router.post("/forgot-pin", async (req, res) => {
  await Pin.deleteMany();
  res.json({ message: "PIN deleted permanently" });
});


export default router;
