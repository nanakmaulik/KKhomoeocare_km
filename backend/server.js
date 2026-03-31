/******************************
 *  SSL FIX (VERY IMPORTANT)
 ******************************/
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import cors from "cors";

import https from "https";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

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
app.get("/", (req, res) => {
  res.send("MediSphere Backend Running 🚀");
});
/******************************
 * MAIN API
 ******************************/


app.post("/book-offline-appointment", async (req, res) => {
  console.log("OFFLINE API HIT 🟢");

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

    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          patientname,
          patientemail: email,
          phone,
          appointmentdate,
          appointmenttime,
          doctor_id,
          slot_id,
          appointment_type: "offline",
          meet_link: null,
          status: "pending"
        }
      ]);
      await supabase
  .from("slots")
  .update({ is_booked: true })
  .eq("id", slot_id);

    if (error) throw error;

    res.json({ success: true, message: "Offline appointment booked successfully" });

  } catch (err) {
    console.error("ERR:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.post("/book-online-appointment", async (req, res) => {
  console.log("ONLINE API HIT 🟢");

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

    const meetLink = await createGoogleMeetLink(appointmentdate, appointmenttime);

    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          patientname,
          patientemail: email,
          phone,
          appointmentdate,
          appointmenttime,
          doctor_id,
          slot_id,
          appointment_type: "online",
          meet_link: meetLink,
          status: "pending"
        }
      ]);
await supabase
  .from("slots")
  .update({ is_booked: true })
  .eq("id", slot_id);
    if (error) throw error;

    // Email patient (optional)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Online Appointment Confirmed",
      html: `
        <h2>Your Online Appointment is Confirmed</h2>
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
// generate google meet link
import { google } from "googleapis";
import fs from "fs";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

const auth = new google.auth.GoogleAuth({
  keyFile: "./service-account.json", // JSON file ka naam
  scopes: SCOPES
});

const calendar = google.calendar({ version: "v3", auth });

async function createGoogleMeetLink(appointmentdate, appointmenttime) {

  const startDateTime = new Date(`${appointmentdate}T${appointmenttime}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

  const event = {
    summary: "MediSphere Online Consultation",
    description: "Your online doctor appointment",
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: "Asia/Kolkata"
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: "Asia/Kolkata"
    },
    conferenceData: {
      createRequest: {
        requestId: Math.random().toString(36).substring(2, 15),
        conferenceSolutionKey: {
          type: "hangoutsMeet"
        }
      }
    }
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    resource: event,
    conferenceDataVersion: 1
  });

  return response.data.hangoutLink;
}
/******************************
 * START SERVER
 ******************************/
app.listen(5000, () => {
  console.log("Server running on port 5000 🚀");
});