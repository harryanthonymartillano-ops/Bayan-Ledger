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
// Get all projects (public read access)
router.get('/', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, projects, error, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .select('*')
                        .order('created_at', { ascending: false })];
            case 1:
                _a = _b.sent(), projects = _a.data, error = _a.error;
                if (error)
                    throw error;
                res.json({ projects: projects });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                logger_js_1.logger.error('Error fetching projects:', error_1);
                res.status(500).json({ error: 'Failed to fetch projects' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get project by ID with all related data
router.get('/:projectId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var projectId, _a, project, projectError, milestones, transactions, documents, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 6]);
                projectId = req.params.projectId;
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .select('*')
                        .eq('id', projectId)
                        .single()];
            case 1:
                _a = _b.sent(), project = _a.data, projectError = _a.error;
                if (projectError)
                    throw projectError;
                if (!project)
                    res.status(404).json({ error: 'Project not found' });
                return [2 /*return*/];
            case 2:
                milestones = (_b.sent()).data;
                return [4 /*yield*/, config_js_1.supabase
                        .from('transactions')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('date', { ascending: false })];
            case 3:
                transactions = (_b.sent()).data;
                return [4 /*yield*/, config_js_1.supabase
                        .from('documents')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('date_uploaded', { ascending: false })];
            case 4:
                documents = (_b.sent()).data;
                res.json({
                    project: project,
                    milestones: milestones || [],
                    transactions: transactions || [],
                    documents: documents || [],
                });
                return [3 /*break*/, 6];
            case 5:
                error_2 = _b.sent();
                logger_js_1.logger.error('Error fetching project:', error_2);
                res.status(500).json({ error: 'Failed to fetch project' });
                return [2 /*return*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
// Create project (MPDC only)
router.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['MPDC', 'Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name_1, description, location_1, category, totalBudget, saro, projectId, _b, project, error, error_3;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                _a = req.body, name_1 = _a.name, description = _a.description, location_1 = _a.location, category = _a.category, totalBudget = _a.totalBudget, saro = _a.saro;
                if (!name_1 || !totalBudget) {
                    res.status(400).json({ error: 'Name and total budget required' });
                    return [2 /*return*/];
                }
                projectId = "PRJ-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 5).toUpperCase());
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .insert({
                        id: projectId,
                        name: name_1,
                        description: description,
                        location: location_1,
                        category: category,
                        total_budget: parseInt(totalBudget),
                        saro: saro,
                        created_by: req.user.id,
                    })
                        .select()
                        .single()];
            case 1:
                _b = _c.sent(), project = _b.data, error = _b.error;
                if (error)
                    throw error;
                // Log audit trail
                return [4 /*yield*/, config_js_1.supabase.from('audit_logs').insert({
                        action: 'PROJECT_CREATED',
                        user_role: req.user.role,
                        user_id: req.user.id,
                        details: "Created project \"".concat(name_1, "\" with budget \u20B1").concat(parseInt(totalBudget).toLocaleString()),
                    })];
            case 2:
                // Log audit trail
                _c.sent();
                logger_js_1.logger.info("Project created: ".concat(projectId, " by ").concat(req.user.email));
                res.status(201).json({ project: project });
                return [3 /*break*/, 4];
            case 3:
                error_3 = _c.sent();
                logger_js_1.logger.error('Project creation error:', error_3);
                res.status(500).json({ error: 'Failed to create project' });
                return [2 /*return*/];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Update project (MPDC only)
router.put('/:projectId', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['MPDC', 'Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var projectId, _a, name_2, description, location_2, category, status_1, _b, project, error, error_4;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                projectId = req.params.projectId;
                _a = req.body, name_2 = _a.name, description = _a.description, location_2 = _a.location, category = _a.category, status_1 = _a.status;
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .update({
                        name: name_2,
                        description: description,
                        location: location_2,
                        category: category,
                        status: status_1,
                        updated_at: new Date().toISOString(),
                    })
                        .eq('id', projectId)
                        .select()
                        .single()];
            case 1:
                _b = _c.sent(), project = _b.data, error = _b.error;
                if (error)
                    throw error;
                if (!project)
                    res.status(404).json({ error: 'Project not found' });
                return [2 /*return*/];
            case 2:
                // Log audit trail
                _c.sent();
                logger_js_1.logger.info("Project updated: ".concat(projectId, " by ").concat(req.user.email));
                res.json({ project: project });
                return [3 /*break*/, 4];
            case 3:
                error_4 = _c.sent();
                logger_js_1.logger.error('Project update error:', error_4);
                res.status(500).json({ error: 'Failed to update project' });
                return [2 /*return*/];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Delete project (Admin only)
router.delete('/:projectId', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var projectId, transactions, error, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                projectId = req.params.projectId;
                return [4 /*yield*/, config_js_1.supabase
                        .from('transactions')
                        .select('id')
                        .eq('project_id', projectId)
                        .limit(1)];
            case 1:
                transactions = (_a.sent()).data;
                if (transactions && transactions.length > 0) {
                    res.status(400).json({ error: 'Cannot delete project with existing transactions' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .delete()
                        .eq('id', projectId)];
            case 2:
                error = (_a.sent()).error;
                if (error)
                    throw error;
                // Log audit trail
                return [4 /*yield*/, config_js_1.supabase.from('audit_logs').insert({
                        action: 'PROJECT_DELETED',
                        user_role: req.user.role,
                        user_id: req.user.id,
                        details: "Deleted project ".concat(projectId),
                    })];
            case 3:
                // Log audit trail
                _a.sent();
                logger_js_1.logger.info("Project deleted: ".concat(projectId, " by ").concat(req.user.email));
                res.json({ message: 'Project deleted successfully' });
                return [3 /*break*/, 5];
            case 4:
                error_5 = _a.sent();
                logger_js_1.logger.error('Project deletion error:', error_5);
                res.status(500).json({ error: 'Failed to delete project' });
                return [2 /*return*/];
            case 5: return [2 /*return*/];
        }
    });
}); });
// Update project status
router.put('/:projectId/status', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['MPDC', 'Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var projectId, status_2, _a, data, error, error_6;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                projectId = req.params.projectId;
                status_2 = req.body.status;
                if (!status_2) {
                    res.status(400).json({ error: 'Status is required' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('projects')
                        .update({ status: status_2, updated_at: new Date().toISOString() })
                        .eq('id', projectId)
                        .select()
                        .single()];
            case 1:
                _a = _b.sent(), data = _a.data, error = _a.error;
                if (error)
                    throw error;
                if (!data)
                    res.status(404).json({ error: 'Project not found' });
                return [2 /*return*/];
            case 2:
                // Log audit trail
                _b.sent();
                logger_js_1.logger.info("Project status updated: ".concat(projectId, " to ").concat(status_2, " by ").concat(req.user.email));
                res.json({ project: data });
                return [3 /*break*/, 4];
            case 3:
                error_6 = _b.sent();
                logger_js_1.logger.error('Project status update error:', error_6);
                res.status(500).json({ error: 'Failed to update project status' });
                return [2 /*return*/];
            case 4: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
