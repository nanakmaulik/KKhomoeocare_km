/******************************
 *  SSL FIX (REMOVE IN PROD)
 ******************************/
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import cors from "cors";
import https from "https";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import path from "node:path";
import process from "node:process";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

dotenv.config();

/******************************
 * EXPRESS SETUP
 ******************************/
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

/******************************
 * SUPABASE
 ******************************/
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    global: {
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          agent: new https.Agent({ rejectUnauthorized: false })
        });
      }
    }
  }
);

/******************************
 * GOOGLE CALENDAR (MEET LINK)
 ******************************/
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

let authClient = null;

async function getAuth() {
  if (!authClient) {
    authClient = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH
    });
  }
  return authClient;
}

async function createMeetLink(date, time) {
  const auth = await getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

  const event = {
    summary: "Doctor Consultation",
    start: {
      dateTime: startDateTime,
      timeZone: "Asia/Kolkata"
    },
    end: {
      dateTime: endDateTime,
      timeZone: "Asia/Kolkata"
    },
    conferenceData: {
      createRequest: {
        requestId: Math.random().toString(36).substring(2),
        conferenceSolutionKey: { type: "hangoutsMeet" }
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
 * EMAIL (GMAIL SMTP)
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
 * ROUTES
 ******************************/
app.get("/", (req, res) => {
  res.send("MediSphere Backend Running 🚀");
});

/******** OFFLINE ********/
app.post("/book-offline-appointment", async (req, res) => {
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

    const { error } = await supabase.from("appointments").insert([
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

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/******** ONLINE ********/
app.post("/book-online-appointment", async (req, res) => {
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

    // ✅ REAL MEET LINK
    const meetLink = await createMeetLink(
      appointmentdate,
      appointmenttime
    );

    const { error } = await supabase.from("appointments").insert([
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
        status: "confirmed"
      }
    ]);

    await supabase
      .from("slots")
      .update({ is_booked: true })
      .eq("id", slot_id);

    if (error) throw error;

    // ✅ EMAIL SEND
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Appointment Confirmation",
      html: `
        <h2>Appointment Confirmed</h2>
        <p>Date: ${appointmentdate}</p>
        <p>Time: ${appointmenttime}</p>
        <p>Meet Link: <a href="${meetLink}">${meetLink}</a></p>
      `
    });

    res.json({
      success: true,
      meetLink
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

/******************************
 * START SERVER
 ******************************/
app.listen(5000, () => {
  console.log("Server running on port 5000 🚀");
});