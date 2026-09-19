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
var express_1 = require("express");
var config_js_1 = require("../db/config.js");
var logger_js_1 = require("../logger.js");
var auth_js_1 = require("../middleware/auth.js");
var router = (0, express_1.Router)();
// Get audit logs (admin only)
router.get('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, page, _c, limit, action, userRole, projectId, query, _d, logs, error, count, error_1;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 2, , 3]);
                _a = req.query, _b = _a.page, page = _b === void 0 ? 1 : _b, _c = _a.limit, limit = _c === void 0 ? 50 : _c, action = _a.action, userRole = _a.userRole, projectId = _a.projectId;
                query = config_js_1.supabase
                    .from('audit_logs')
                    .select('*')
                    .order('timestamp', { ascending: false })
                    .range((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit) - 1);
                if (action) {
                    query = query.eq('action', action);
                }
                if (userRole) {
                    query = query.eq('user_role', userRole);
                }
                if (projectId) {
                    query = query.ilike('details', "%".concat(projectId, "%"));
                }
                return [4 /*yield*/, query];
            case 1:
                _d = _e.sent(), logs = _d.data, error = _d.error, count = _d.count;
                if (error)
                    throw error;
                res.json({
                    logs: logs,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                    },
                });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _e.sent();
                logger_js_1.logger.error('Error fetching audit logs:', error_1);
                res.status(500).json({ error: 'Failed to fetch audit logs' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get audit logs for a specific project
router.get('/project/:projectId', auth_js_1.authenticateToken, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var projectId, _a, logs, error, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                projectId = req.params.projectId;
                return [4 /*yield*/, config_js_1.supabase
                        .from('audit_logs')
                        .select('*')
                        .ilike('details', "%".concat(projectId, "%"))
                        .order('timestamp', { ascending: false })
                        .limit(100)];
            case 1:
                _a = _b.sent(), logs = _a.data, error = _a.error;
                if (error)
                    throw error;
                res.json({ logs: logs });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _b.sent();
                logger_js_1.logger.error('Error fetching project audit logs:', error_2);
                res.status(500).json({ error: 'Failed to fetch project audit logs' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get audit logs for current user
router.get('/my-activity', auth_js_1.authenticateToken, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, logs, error, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, config_js_1.supabase
                        .from('audit_logs')
                        .select('*')
                        .eq('user_id', req.user.id)
                        .order('timestamp', { ascending: false })
                        .limit(50)];
            case 1:
                _a = _b.sent(), logs = _a.data, error = _a.error;
                if (error)
                    throw error;
                res.json({ logs: logs });
                return [3 /*break*/, 3];
            case 2:
                error_3 = _b.sent();
                logger_js_1.logger.error('Error fetching user audit logs:', error_3);
                res.status(500).json({ error: 'Failed to fetch user audit logs' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Create manual audit log entry (admin only)
router.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, action, details, hash, _b, log, error, error_4;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                _a = req.body, action = _a.action, details = _a.details, hash = _a.hash;
                if (!action || !details) {
                    res.status(400).json({ error: 'Action and details required' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('audit_logs')
                        .insert({
                        action: action,
                        user_role: req.user.role,
                        user_id: req.user.id,
                        details: details,
                        hash: hash,
                    })
                        .select()
                        .single()];
            case 1:
                _b = _c.sent(), log = _b.data, error = _b.error;
                if (error)
                    throw error;
                logger_js_1.logger.info("Manual audit log created: ".concat(action, " by ").concat(req.user.email));
                res.status(201).json({ log: log });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _c.sent();
                logger_js_1.logger.error('Manual audit log creation error:', error_4);
                res.status(500).json({ error: 'Failed to create audit log' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
