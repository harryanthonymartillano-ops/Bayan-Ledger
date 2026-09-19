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
// Get milestones for a project
router.get('/project/:projectId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var projectId, _a, milestones, error, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                projectId = req.params.projectId;
                return [4 /*yield*/, config_js_1.supabase
                        .from('milestones')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('created_at', { ascending: true })];
            case 1:
                _a = _b.sent(), milestones = _a.data, error = _a.error;
                if (error)
                    throw error;
                res.json({ milestones: milestones });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                logger_js_1.logger.error('Error fetching milestones:', error_1);
                res.status(500).json({ error: 'Failed to fetch milestones' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Create new milestone (MPDC only)
router.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['MPDC', 'Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, projectId, title, description, percentage, _b, milestone, error, error_2;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                _a = req.body, projectId = _a.projectId, title = _a.title, description = _a.description, percentage = _a.percentage;
                if (!projectId || !title || !percentage) {
                    res.status(400).json({ error: 'Project ID, title, and percentage required' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('milestones')
                        .insert({
                        project_id: projectId,
                        title: title,
                        description: description,
                        percentage: parseInt(percentage),
                    })
                        .select()
                        .single()];
            case 1:
                _b = _c.sent(), milestone = _b.data, error = _b.error;
                if (error)
                    throw error;
                // Log audit trail
                return [4 /*yield*/, config_js_1.supabase.from('audit_logs').insert({
                        action: 'MILESTONE_CREATED',
                        user_role: req.user.role,
                        user_id: req.user.id,
                        details: "Created milestone \"".concat(title, "\" for project ").concat(projectId),
                    })];
            case 2:
                // Log audit trail
                _c.sent();
                logger_js_1.logger.info("Milestone created: ".concat(title, " by ").concat(req.user.email));
                res.status(201).json({ milestone: milestone });
                return [3 /*break*/, 4];
            case 3:
                error_2 = _c.sent();
                logger_js_1.logger.error('Milestone creation error:', error_2);
                res.status(500).json({ error: 'Failed to create milestone' });
                return [2 /*return*/];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Verify milestone with photo (MPDC only)
router.put('/:milestoneId/verify', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['MPDC', 'Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var milestoneId, _a, photoUrl, ipfsHash, _b, milestone, error, error_3;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                milestoneId = req.params.milestoneId;
                _a = req.body, photoUrl = _a.photoUrl, ipfsHash = _a.ipfsHash;
                if (!photoUrl) {
                    res.status(400).json({ error: 'Photo URL required' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('milestones')
                        .update({
                        status: 'Verified',
                        date_verified: new Date().toISOString(),
                        verified_by: req.user.id,
                        photo_url: photoUrl,
                        ipfs_hash: ipfsHash,
                    })
                        .eq('id', milestoneId)
                        .select()
                        .single()];
            case 1:
                _b = _c.sent(), milestone = _b.data, error = _b.error;
                if (error)
                    throw error;
                if (!milestone)
                    res.status(404).json({ error: 'Milestone not found' });
                return [2 /*return*/];
            case 2:
                // Log audit trail
                _c.sent();
                logger_js_1.logger.info("Milestone verified: ".concat(milestone.title, " by ").concat(req.user.email));
                res.json({ milestone: milestone });
                return [3 /*break*/, 4];
            case 3:
                error_3 = _c.sent();
                logger_js_1.logger.error('Milestone verification error:', error_3);
                res.status(500).json({ error: 'Failed to verify milestone' });
                return [2 /*return*/];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Update milestone status
router.put('/:milestoneId/status', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)(['MPDC', 'Admin']), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var milestoneId, status_1, _a, milestone, error, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                milestoneId = req.params.milestoneId;
                status_1 = req.body.status;
                if (!['Pending', 'In Progress', 'Verified', 'Rejected'].includes(status_1)) {
                    res.status(400).json({ error: 'Invalid status' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, config_js_1.supabase
                        .from('milestones')
                        .update({ status: status_1 })
                        .eq('id', milestoneId)
                        .select()
                        .single()];
            case 1:
                _a = _b.sent(), milestone = _a.data, error = _a.error;
                if (error)
                    throw error;
                if (!milestone)
                    res.status(404).json({ error: 'Milestone not found' });
                return [2 /*return*/];
            case 2:
                error_4 = _b.sent();
                logger_js_1.logger.error('Milestone status update error:', error_4);
                res.status(500).json({ error: 'Failed to update milestone status' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
