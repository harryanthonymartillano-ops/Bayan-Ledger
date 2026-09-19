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
// Get transactions for a project
router.get('/project/:projectId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var projectId, _a, transactions, error, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                projectId = req.params.projectId;
                return [4 /*yield*/, config_js_1.supabase
                        .from('transactions')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('date', { ascending: false })];
            case 1:
                _a = _b.sent(), transactions = _a.data, error = _a.error;
                if (error)
                    throw error;
                res.json({ transactions: transactions });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                logger_js_1.logger.error('Error fetching transactions:', error_1);
                res.status(500).json({ error: 'Failed to fetch transactions' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Allocate funds to project (Budget Officer only)
router.post('/allocate', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['Budget Officer', 'Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, projectId, amount, description, saro, _b, project, projectError, newAllocatedFunds, _c, transaction, transactionError, error_2;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 5, , 6]);
                _a = req.body, projectId = _a.projectId, amount = _a.amount, description = _a.description, saro = _a.saro;
                if (!projectId || !amount) {
                    res.status(400).json({ error: 'Project ID and amount required' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .select('allocated_funds, total_budget')
                        .eq('id', projectId)
                        .single()];
            case 1:
                _b = _d.sent(), project = _b.data, projectError = _b.error;
                if (projectError || !project) {
                    res.status(404).json({ error: 'Project not found' });
                    return [2 /*return*/];
                }
                newAllocatedFunds = (project.allocated_funds || 0) + parseInt(amount);
                if (newAllocatedFunds > project.total_budget) {
                    res.status(400).json({ error: 'Allocation exceeds total budget' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('transactions')
                        .insert({
                        project_id: projectId,
                        amount: parseInt(amount),
                        type: 'Allocation',
                        date: new Date().toISOString(),
                        recorded_by: req.user.id,
                        recorded_by_role: req.user.role,
                        description: description || 'Fund allocation',
                        saro: saro,
                    })
                        .select()
                        .single()];
            case 2:
                _c = _d.sent(), transaction = _c.data, transactionError = _c.error;
                if (transactionError)
                    throw transactionError;
                // Update project allocated funds
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .update({ allocated_funds: newAllocatedFunds })
                        .eq('id', projectId)];
            case 3:
                // Update project allocated funds
                _d.sent();
                // Log audit trail
                return [4 /*yield*/, config_js_1.supabase.from('audit_logs').insert({
                        action: 'FUNDS_ALLOCATED',
                        user_role: req.user.role,
                        user_id: req.user.id,
                        details: "Allocated \u20B1".concat(amount.toLocaleString(), " to project ").concat(projectId),
                    })];
            case 4:
                // Log audit trail
                _d.sent();
                logger_js_1.logger.info("Funds allocated: \u20B1".concat(amount, " to project ").concat(projectId, " by ").concat(req.user.email));
                res.status(201).json({ transaction: transaction });
                return [3 /*break*/, 6];
            case 5:
                error_2 = _d.sent();
                logger_js_1.logger.error('Fund allocation error:', error_2);
                res.status(500).json({ error: 'Failed to allocate funds' });
                return [2 /*return*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
// Disburse funds for verified milestone (Treasurer only)
router.post('/disburse', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['Treasurer', 'Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, projectId, milestoneId, amount, description, saro, transactionHash, _b, milestone, milestoneError, _c, project, projectError, availableFunds, _d, transaction, transactionError, newDisbursedFunds, error_3;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 6, , 7]);
                _a = req.body, projectId = _a.projectId, milestoneId = _a.milestoneId, amount = _a.amount, description = _a.description, saro = _a.saro, transactionHash = _a.transactionHash;
                if (!projectId || !milestoneId || !amount) {
                    res.status(400).json({ error: 'Project ID, milestone ID, and amount required' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('milestones')
                        .select('status, percentage')
                        .eq('id', milestoneId)
                        .eq('status', 'Verified')
                        .single()];
            case 1:
                _b = _e.sent(), milestone = _b.data, milestoneError = _b.error;
                if (milestoneError || !milestone) {
                    res.status(400).json({ error: 'Milestone not found or not verified' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .select('allocated_funds, disbursed_funds')
                        .eq('id', projectId)
                        .single()];
            case 2:
                _c = _e.sent(), project = _c.data, projectError = _c.error;
                if (projectError || !project) {
                    res.status(404).json({ error: 'Project not found' });
                    return [2 /*return*/];
                }
                availableFunds = (project.allocated_funds || 0) - (project.disbursed_funds || 0);
                if (parseInt(amount) > availableFunds) {
                    res.status(400).json({ error: 'Insufficient allocated funds' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('transactions')
                        .insert({
                        project_id: projectId,
                        amount: parseInt(amount),
                        type: 'Disbursement',
                        date: new Date().toISOString(),
                        recorded_by: req.user.id,
                        recorded_by_role: req.user.role,
                        description: description || "Disbursement for milestone: ".concat(milestoneId),
                        hash: transactionHash,
                        saro: saro,
                    })
                        .select()
                        .single()];
            case 3:
                _d = _e.sent(), transaction = _d.data, transactionError = _d.error;
                if (transactionError)
                    throw transactionError;
                newDisbursedFunds = (project.disbursed_funds || 0) + parseInt(amount);
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .update({ disbursed_funds: newDisbursedFunds })
                        .eq('id', projectId)];
            case 4:
                _e.sent();
                // Log audit trail
                return [4 /*yield*/, config_js_1.supabase.from('audit_logs').insert({
                        action: 'FUNDS_DISBURSED',
                        user_role: req.user.role,
                        user_id: req.user.id,
                        details: "Disbursed \u20B1".concat(amount.toLocaleString(), " for milestone ").concat(milestoneId),
                        hash: transactionHash,
                    })];
            case 5:
                // Log audit trail
                _e.sent();
                logger_js_1.logger.info("Funds disbursed: \u20B1".concat(amount, " for milestone ").concat(milestoneId, " by ").concat(req.user.email));
                res.status(201).json({ transaction: transaction });
                return [3 /*break*/, 7];
            case 6:
                error_3 = _e.sent();
                logger_js_1.logger.error('Fund disbursement error:', error_3);
                res.status(500).json({ error: 'Failed to disburse funds' });
                return [2 /*return*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
// Get all transactions (admin only)
router.get('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, transactions, error, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, config_js_1.supabase
                        .from('transactions')
                        .select("\n        *,\n        projects (name)\n      ")
                        .order('date', { ascending: false })
                        .limit(100)];
            case 1:
                _a = _b.sent(), transactions = _a.data, error = _a.error;
                if (error)
                    throw error;
                res.json({ transactions: transactions });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _b.sent();
                logger_js_1.logger.error('Error fetching all transactions:', error_4);
                res.status(500).json({ error: 'Failed to fetch transactions' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
