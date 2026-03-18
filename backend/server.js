/******************************
 *  SSL FIX (VERY IMPORTANT)
 ******************************/
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import https from "https";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

/******************************
 * EXPRESS SETUP
 ******************************/
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

/******************************
 * SUPABASE CLIENT (NO EXTRA FETCH)
 ******************************/
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    global: {
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          agent: new https.Agent({ rejectUnauthorized: false }) // SSL fix here too
        });
      }
    }
  }
);

/******************************
 * MEET LINK GENERATOR
 ******************************/
function generateMeetLink() {
  let id =
    Math.random().toString(36).substring(2, 6) +
    "-" +
    Math.random().toString(36).substring(2, 10);

  return "https://meet.google.com/" + id;
}

/******************************
 * GMAIL SMTP
 ******************************/
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  secure: false, 
  tls: {
    rejectUnauthorized: false
  }
});

/******************************
 * MAIN API
 ******************************/
app.post("/book-video-appointment", async (req, res) => {
  console.log("API HIT HO RAHI HAI 🟢");

  try {
    const {
      patientname,
      email,
      phone,
      appointmentdate,
      appointmenttime,
      doctor_id,
      slot_id
    } = req.body;

    const meetLink = generateMeetLink();

    /******************************
     * INSERT INTO SUPABASE
     ******************************/
    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          patientname,
          email,
          phone,
          appointmentdate,
          appointmenttime,
          doctor_id,
          slot_id,
          meet_link: meetLink
        }
      ]);

    if (error) throw error;

    /******************************
     * SEND EMAIL — PATIENT
     ******************************/
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Appointment Confirmed",
      html: `
        <h2>Your Appointment is Confirmed</h2>
        <p><strong>Date:</strong> ${appointmentdate}</p>
        <p><strong>Time:</strong> ${appointmenttime}</p>
        <p><strong>Meet Link:</strong> <a href="${meetLink}">${meetLink}</a></p>
      `
    });

    /******************************
     * SEND EMAIL — DOCTOR
     ******************************/
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "doctor@gmail.com", // later dynamic
      subject: "New Appointment",
      html: `
        <h2>New Appointment</h2>
        <p><strong>Patient:</strong> ${patientname}</p>
        <p><strong>Date:</strong> ${appointmentdate}</p>
        <p><strong>Time:</strong> ${appointmenttime}</p>
        <p><strong>Meet Link:</strong> <a href="${meetLink}">${meetLink}</a></p>
      `
    });

    res.json({ success: true, meet_link: meetLink });

  } catch (err) {
    console.error("ERR:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

/******************************
 * START SERVER
 ******************************/
app.listen(5000, () => {
  console.log("Server running on port 5000 🚀");
});