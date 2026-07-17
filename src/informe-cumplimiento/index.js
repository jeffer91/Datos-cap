"use strict";
const { createComplianceReportService, ComplianceReportService } = require("./informe-cumplimiento.service");
const { buildGlobalReport, buildCoverage, calculateMetrics } = require("./informe-cumplimiento.engine");
module.exports = { createComplianceReportService, ComplianceReportService, buildGlobalReport, buildCoverage, calculateMetrics };
