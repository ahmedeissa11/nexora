"use strict";

const { createClient } = require("@supabase/supabase-js");
const { config } = require("../config");

let admin;
let anon;

function assertConfigured() {
  if (!config.supabaseConfigured) {
    const err = new Error("Supabase Auth is not configured");
    err.status = 503;
    throw err;
  }
}

function adminClient() {
  assertConfigured();
  if (!admin) {
    admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return admin;
}

function anonClient() {
  assertConfigured();
  if (!anon) {
    anon = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return anon;
}

module.exports = { adminClient, anonClient };
