import { createHash, randomBytes } from "crypto";
import type { MefReturnPayload } from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Generate IRS-style submission id (unique per package) */
export function generateSubmissionId(efin: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString("hex").toUpperCase();
  const e = (efin || "000000").slice(0, 6);
  return `${e}${ts}${rand}`.slice(0, 20);
}

/**
 * Build simplified MeF-compatible Return + IRSSubmissionManifest XML.
 * Structure follows MeF concepts (Manifest + ReturnData) for transmitter handoff.
 * Full production schemas are year-specific XSD packages from IRS.
 */
export function buildMefPackage(
  payload: MefReturnPayload,
  opts: { submissionId: string; efin: string; etin: string; environment: string }
): { returnXml: string; manifestXml: string; contentHash: string } {
  const ssn = (payload.taxpayer.ssnFull || "").replace(/\D/g, "") || "000000000";
  const tinMasked = `***-**-${ssn.slice(-4) || "0000"}`;

  const returnXml = `<?xml version="1.0" encoding="UTF-8"?>
<Return xmlns="http://www.irs.gov/efile" returnVersion="${payload.taxYear}v1.0">
  <ReturnHeader binaryAttachmentCnt="0">
    <Timestamp>${new Date().toISOString()}</Timestamp>
    <TaxPeriodBeginDt>${payload.taxYear}-01-01</TaxPeriodBeginDt>
    <TaxPeriodEndDt>${payload.taxYear}-12-31</TaxPeriodEndDt>
    <SoftwareId>TAXPORTAL</SoftwareId>
    <SoftwareVersionNum>peak-1.0</SoftwareVersionNum>
    <OriginatorGrp>
      <EFIN>${esc(opts.efin)}</EFIN>
      <OriginatorTypeCd>ERO</OriginatorTypeCd>
    </OriginatorGrp>
    <PreparerFirmGrp>
      <PreparerFirmName>
        <BusinessNameLine1Txt>${esc(payload.preparer.firmName || payload.preparer.name)}</BusinessNameLine1Txt>
      </PreparerFirmName>
    </PreparerFirmGrp>
    <ReturnTypeCd>${esc(payload.formType)}</ReturnTypeCd>
    <Filer>
      <PrimarySSN>${esc(ssn)}</PrimarySSN>
      <NameLine1Txt>${esc(`${payload.taxpayer.firstName} ${payload.taxpayer.lastName}`)}</NameLine1Txt>
      <PrimaryNameControlTxt>${esc(payload.taxpayer.lastName.slice(0, 4).toUpperCase())}</PrimaryNameControlTxt>
      <USAddress>
        <AddressLine1Txt>${esc(payload.taxpayer.address.street)}</AddressLine1Txt>
        <CityNm>${esc(payload.taxpayer.address.city)}</CityNm>
        <StateAbbreviationCd>${esc(payload.taxpayer.address.state.toUpperCase())}</StateAbbreviationCd>
        <ZIPCd>${esc(payload.taxpayer.address.zip.replace(/\D/g, "").slice(0, 9))}</ZIPCd>
      </USAddress>
    </Filer>
  </ReturnHeader>
  <ReturnData documentCnt="1">
    <IRS${esc(payload.formType.replace("-", ""))} documentId="RetDoc1">
      <IndividualReturnFilingStatusCd>${esc(payload.taxpayer.filingStatus)}</IndividualReturnFilingStatusCd>
      <WagesSalariesAndTipsAmt>${money(payload.income.wages)}</WagesSalariesAndTipsAmt>
      <TaxableInterestAmt>${money(payload.income.interest)}</TaxableInterestAmt>
      <OrdinaryDividendsAmt>${money(payload.income.dividends)}</OrdinaryDividendsAmt>
      <BusinessIncomeLossAmt>${money(payload.income.businessIncome)}</BusinessIncomeLossAmt>
      <CapitalGainLossAmt>${money(payload.income.capitalGains)}</CapitalGainLossAmt>
      <TotalOtherIncomeAmt>${money(payload.income.otherIncome)}</TotalOtherIncomeAmt>
      <TotalIncomeAmt>${money(
        (payload.income.wages ?? 0) +
          (payload.income.interest ?? 0) +
          (payload.income.dividends ?? 0) +
          (payload.income.businessIncome ?? 0) +
          (payload.income.capitalGains ?? 0) +
          (payload.income.otherIncome ?? 0)
      )}</TotalIncomeAmt>
      <TotalItemizedOrStandardDeductionAmt>${money(payload.deductions.amount)}</TotalItemizedOrStandardDeductionAmt>
      <TotalTaxBeforeCrAndOthTaxesAmt>${money(payload.tax.totalTax)}</TotalTaxBeforeCrAndOthTaxesAmt>
      <WithholdingTaxAmt>${money(payload.tax.withholdings)}</WithholdingTaxAmt>
      <EstimatedTaxPaymentsAmt>${money(payload.tax.estimatedPayments)}</EstimatedTaxPaymentsAmt>
      <RefundAmt>${money(Math.max(0, payload.tax.refundOrOwe ?? 0))}</RefundAmt>
      <AmountOwedAmt>${money(Math.max(0, -(payload.tax.refundOrOwe ?? 0)))}</AmountOwedAmt>
      <!-- TIN display ref (masked in comments only): ${tinMasked} -->
    </IRS${esc(payload.formType.replace("-", ""))}>
  </ReturnData>
</Return>`;

  const contentHash = createHash("sha256").update(returnXml).digest("hex");

  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<IRSSubmissionManifest xmlns="http://www.irs.gov/efile">
  <SubmissionId>${esc(opts.submissionId)}</SubmissionId>
  <EFIN>${esc(opts.efin)}</EFIN>
  <TaxYr>${payload.taxYear}</TaxYr>
  <GovernmentCd>IRS</GovernmentCd>
  <FederalSubmissionTypeCd>${esc(payload.formType)}</FederalSubmissionTypeCd>
  <TaxPeriodBeginDt>${payload.taxYear}-01-01</TaxPeriodBeginDt>
  <TaxPeriodEndDt>${payload.taxYear}-12-31</TaxPeriodEndDt>
  <TIN>${esc(ssn)}</TIN>
  <ETIN>${esc(opts.etin)}</ETIN>
  <PrimaryNameControlTxt>${esc(payload.taxpayer.lastName.slice(0, 4).toUpperCase())}</PrimaryNameControlTxt>
  <SubmissionCategoryCd>IND</SubmissionCategoryCd>
  <Environment>${esc(opts.environment)}</Environment>
  <SoftwareId>TAXPORTAL</SoftwareId>
  <ReturnHash>${contentHash}</ReturnHash>
</IRSSubmissionManifest>`;

  return { returnXml, manifestXml, contentHash };
}

/** Redact SSN from XML for logging / UI preview */
export function redactSsnInXml(xml: string): string {
  return xml
    .replace(/<PrimarySSN>\d{9}<\/PrimarySSN>/g, "<PrimarySSN>*********</PrimarySSN>")
    .replace(/<TIN>\d{9}<\/TIN>/g, "<TIN>*********</TIN>");
}
