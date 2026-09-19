"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.initializeDatabase = initializeDatabase;
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
}
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
    },
});
function initializeDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, exports.supabase.from('projects').select('id').limit(1)];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (!(error && error.code === 'PGRST116')) return [3 /*break*/, 3];
                    console.log('Database tables not initialized. Running migrations...');
                    return [4 /*yield*/, runMigrations()];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    if (error) {
                        throw error;
                    }
                    else {
                        console.log('Database connected successfully');
                    }
                    _b.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_1 = _b.sent();
                    console.error('Database initialization failed:', error_1);
                    throw error_1;
                case 6: return [2 /*return*/];
            }
        });
    });
}
function runMigrations() {
    return __awaiter(this, void 0, void 0, function () {
        var projectsError, error, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.supabase.rpc('exec_sql', {
                            sql: "\n        CREATE TABLE IF NOT EXISTS projects (\n          id TEXT PRIMARY KEY,\n          name TEXT NOT NULL,\n          description TEXT,\n          location TEXT,\n          category TEXT,\n          total_budget BIGINT NOT NULL,\n          allocated_funds BIGINT DEFAULT 0,\n          disbursed_funds BIGINT DEFAULT 0,\n          status TEXT DEFAULT 'Pending',\n          saro TEXT,\n          created_by TEXT,\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n        );\n\n        CREATE TABLE IF NOT EXISTS milestones (\n          id TEXT PRIMARY KEY,\n          project_id TEXT NOT NULL,\n          title TEXT NOT NULL,\n          description TEXT,\n          percentage INT NOT NULL,\n          status TEXT DEFAULT 'Pending',\n          date_verified TIMESTAMP WITH TIME ZONE,\n          verified_by TEXT,\n          photo_url TEXT,\n          ipfs_hash TEXT,\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE\n        );\n\n        CREATE TABLE IF NOT EXISTS transactions (\n          id TEXT PRIMARY KEY,\n          project_id TEXT NOT NULL,\n          amount BIGINT NOT NULL,\n          type TEXT NOT NULL,\n          date TIMESTAMP WITH TIME ZONE NOT NULL,\n          recorded_by TEXT,\n          recorded_by_role TEXT,\n          description TEXT,\n          hash TEXT,\n          saro TEXT,\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE\n        );\n\n        CREATE TABLE IF NOT EXISTS documents (\n          id TEXT PRIMARY KEY,\n          project_id TEXT NOT NULL,\n          title TEXT NOT NULL,\n          type TEXT NOT NULL,\n          url TEXT NOT NULL,\n          uploaded_by TEXT,\n          date_uploaded TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE\n        );\n\n        CREATE TABLE IF NOT EXISTS audit_logs (\n          id TEXT PRIMARY KEY,\n          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n          action TEXT NOT NULL,\n          user_role TEXT,\n          user_id TEXT,\n          details TEXT,\n          hash TEXT,\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n        );\n\n        CREATE TABLE IF NOT EXISTS system_alerts (\n          id TEXT PRIMARY KEY,\n          project_id TEXT NOT NULL,\n          message TEXT NOT NULL,\n          status TEXT DEFAULT 'Unresolved',\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n          resolved_at TIMESTAMP WITH TIME ZONE,\n          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE\n        );\n\n        CREATE TABLE IF NOT EXISTS users (\n          id TEXT PRIMARY KEY,\n          email TEXT UNIQUE NOT NULL,\n          wallet_address TEXT,\n          role TEXT NOT NULL,\n          status TEXT DEFAULT 'Active',\n          last_login TIMESTAMP WITH TIME ZONE,\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n        );\n\n        CREATE TABLE IF NOT EXISTS proposals (\n          id TEXT PRIMARY KEY,\n          title TEXT NOT NULL,\n          description TEXT,\n          author TEXT,\n          votes INT DEFAULT 0,\n          status TEXT DEFAULT 'Pending',\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n        );\n      "
                        })];
                case 1:
                    projectsError = (_a.sent()).error, error = projectsError;
                    if (error)
                        throw error;
                    console.log('Database migrations completed');
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error('Migration failed:', error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
