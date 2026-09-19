"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var multer_1 = require("multer");
var cloudinary_1 = require("cloudinary");
var config_js_1 = require("../db/config.js");
var logger_js_1 = require("../logger.js");
var auth_js_1 = require("../middleware/auth.js");
var fs_1 = require("fs");
var path_1 = require("path");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
});
// Configure multer for memory storage
var storage = multer_1.default.memoryStorage();
var upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow common document and image types
        var allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
        }
    },
});
var router = (0, express_1.Router)();
// Get documents for a project
router.get('/project/:projectId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var projectId, _a, documents, error, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                projectId = req.params.projectId;
                return [4 /*yield*/, config_js_1.supabase
                        .from('documents')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('date_uploaded', { ascending: false })];
            case 1:
                _a = _b.sent(), documents = _a.data, error = _a.error;
                if (error)
                    throw error;
                res.json({ documents: documents });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                logger_js_1.logger.error('Error fetching documents:', error_1);
                res.status(500).json({ error: 'Failed to fetch documents' });
                return [2 /*return*/];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Upload document
router.post('/upload', auth_js_1.authenticateToken, upload.single('file'), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, projectId_1, title, type, fileUrl, uploadResult, uploadDir, projectDir, fileName, filePath, _b, document_1, error, error_2;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 6, , 7]);
                if (!req.file) {
                    res.status(400).json({ error: 'No file uploaded' });
                    return [2 /*return*/];
                }
                _a = req.body, projectId_1 = _a.projectId, title = _a.title, type = _a.type;
                if (!projectId_1 || !title || !type) {
                    res.status(400).json({ error: 'Project ID, title, and type required' });
                    return [2 /*return*/];
                }
                fileUrl = void 0;
                uploadResult = null;
                if (!(process.env.USE_LOCAL_STORAGE === 'true')) return [3 /*break*/, 1];
                uploadDir = process.env.UPLOAD_DIR || './uploads';
                projectDir = path_1.default.join(uploadDir, 'projects', projectId_1);
                // Ensure directory exists
                if (!fs_1.default.existsSync(projectDir)) {
                    fs_1.default.mkdirSync(projectDir, { recursive: true });
                }
                fileName = "".concat(Date.now(), "-").concat(req.file.originalname);
                filePath = path_1.default.join(projectDir, fileName);
                fs_1.default.writeFileSync(filePath, req.file.buffer);
                fileUrl = "/uploads/projects/".concat(projectId_1, "/").concat(fileName);
                return [3 /*break*/, 3];
            case 1: return [4 /*yield*/, new Promise(function (resolve, reject) {
                    var stream = cloudinary_1.v2.uploader.upload_stream({
                        folder: "sta-cruz-chain/projects/".concat(projectId_1),
                        public_id: "".concat(Date.now(), "-").concat(req.file.originalname),
                        resource_type: 'auto',
                    }, function (error, result) {
                        if (error)
                            reject(error);
                        else
                            resolve(result);
                    });
                    stream.end(req.file.buffer);
                })];
            case 2:
                // Cloudinary upload
                uploadResult = _c.sent();
                fileUrl = uploadResult.secure_url;
                _c.label = 3;
            case 3: return [4 /*yield*/, config_js_1.supabase
                    .from('documents')
                    .insert({
                    project_id: projectId_1,
                    title: title,
                    type: type,
                    url: fileUrl,
                    uploaded_by: req.user.id,
                })
                    .select()
                    .single()];
            case 4:
                _b = _c.sent(), document_1 = _b.data, error = _b.error;
                if (error)
                    throw error;
                // Log audit trail
                return [4 /*yield*/, config_js_1.supabase.from('audit_logs').insert({
                        action: 'DOCUMENT_UPLOADED',
                        user_role: req.user.role,
                        user_id: req.user.id,
                        details: "Uploaded document \"".concat(title, "\" to project ").concat(projectId_1, " (").concat(process.env.USE_LOCAL_STORAGE === 'true' ? 'local storage' : 'cloud storage', ")"),
                    })];
            case 5:
                // Log audit trail
                _c.sent();
                logger_js_1.logger.info("Document uploaded: ".concat(title, " by ").concat(req.user.email));
                res.status(201).json(__assign({ document: document_1 }, (process.env.USE_LOCAL_STORAGE !== 'true' && { cloudinary: uploadResult })));
                return [3 /*break*/, 7];
            case 6:
                error_2 = _c.sent();
                logger_js_1.logger.error('Document upload error:', error_2);
                res.status(500).json({ error: 'Failed to upload document' });
                return [2 /*return*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
// Delete document
router.delete('/:documentId', auth_js_1.authenticateToken, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var documentId, _a, document_2, fetchError, publicId, deleteError, error_3;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 6, , 7]);
                documentId = req.params.documentId;
                return [4 /*yield*/, config_js_1.supabase
                        .from('documents')
                        .select('*')
                        .eq('id', documentId)
                        .single()];
            case 1:
                _a = _c.sent(), document_2 = _a.data, fetchError = _a.error;
                if (fetchError || !document_2) {
                    res.status(404).json({ error: 'Document not found' });
                    return [2 /*return*/];
                }
                // Check permissions (owner or admin)
                if (document_2.uploaded_by !== req.user.id && req.user.role !== 'Admin') {
                    res.status(403).json({ error: 'Not authorized to delete this document' });
                    return [2 /*return*/];
                }
                publicId = (_b = document_2.url.split('/').pop()) === null || _b === void 0 ? void 0 : _b.split('.')[0];
                if (!publicId) return [3 /*break*/, 3];
                return [4 /*yield*/, cloudinary_1.v2.uploader.destroy("sta-cruz-chain/projects/".concat(document_2.project_id, "/").concat(publicId))];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3: return [4 /*yield*/, config_js_1.supabase
                    .from('documents')
                    .delete()
                    .eq('id', documentId)];
            case 4:
                deleteError = (_c.sent()).error;
                if (deleteError)
                    throw deleteError;
                // Log audit trail
                return [4 /*yield*/, config_js_1.supabase.from('audit_logs').insert({
                        action: 'DOCUMENT_DELETED',
                        user_role: req.user.role,
                        user_id: req.user.id,
                        details: "Deleted document \"".concat(document_2.title, "\" from project ").concat(document_2.project_id),
                    })];
            case 5:
                // Log audit trail
                _c.sent();
                logger_js_1.logger.info("Document deleted: ".concat(document_2.title, " by ").concat(req.user.email));
                res.json({ message: 'Document deleted successfully' });
                return [3 /*break*/, 7];
            case 6:
                error_3 = _c.sent();
                logger_js_1.logger.error('Document deletion error:', error_3);
                res.status(500).json({ error: 'Failed to delete document' });
                return [2 /*return*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
