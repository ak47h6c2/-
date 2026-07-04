import type { CandidateFieldKey, AutofillSensitivity } from "./autofill";
import type { MarketCode } from "./markets";

export type CandidateProfileValue = {
  key: CandidateFieldKey;
  label: string;
  value: string;
  market?: MarketCode;
  sensitivity: AutofillSensitivity;
};

export const sampleCandidateProfile: CandidateProfileValue[] = [
  { key: "givenName", label: "名", value: "Your", sensitivity: "safe" },
  { key: "familyName", label: "姓", value: "Name", sensitivity: "safe" },
  { key: "preferredName", label: "常用名/英文名", value: "Your", sensitivity: "safe" },
  { key: "chineseName", label: "中文姓名", value: "你的中文名", sensitivity: "safe" },
  { key: "fullName", label: "姓名", value: "Your Name", sensitivity: "safe" },
  { key: "email", label: "邮箱", value: "your.email@example.com", sensitivity: "safe" },
  { key: "phone", label: "电话", value: "+61 400 000 000", sensitivity: "safe" },
  { key: "wechatId", label: "微信", value: "", market: "CN", sensitivity: "review" },
  { key: "addressLine1", label: "地址", value: "Sydney NSW", market: "AU", sensitivity: "safe" },
  { key: "city", label: "城市", value: "Sydney", market: "AU", sensitivity: "safe" },
  { key: "state", label: "州/省", value: "NSW", market: "AU", sensitivity: "safe" },
  { key: "country", label: "国家/地区", value: "Australia", market: "AU", sensitivity: "safe" },
  { key: "postalCode", label: "邮编", value: "", market: "AU", sensitivity: "safe" },
  { key: "linkedInUrl", label: "LinkedIn", value: "https://www.linkedin.com/in/your-profile", sensitivity: "safe" },
  { key: "githubUrl", label: "GitHub", value: "https://github.com/your-handle", sensitivity: "safe" },
  { key: "portfolioUrl", label: "作品集", value: "https://your-portfolio.dev", sensitivity: "safe" },
  { key: "school", label: "学校", value: "UNSW", sensitivity: "safe" },
  { key: "degree", label: "学位", value: "Master of Information Technology", sensitivity: "safe" },
  { key: "major", label: "专业", value: "Software Engineering", sensitivity: "safe" },
  { key: "graduationMonth", label: "毕业月份", value: "November", sensitivity: "safe" },
  { key: "graduationYear", label: "毕业年份", value: "2027", sensitivity: "safe" },
  { key: "salaryExpectation", label: "期望薪资", value: "", sensitivity: "review" },
  { key: "noticePeriod", label: "到岗时间", value: "可协商", sensitivity: "review" },
  { key: "availableStartDate", label: "可入职日期", value: "", sensitivity: "review" },
  { key: "relocation", label: "是否接受异地/调剂", value: "按岗位和市场确认", sensitivity: "review" },
  { key: "workExperienceYears", label: "工作/项目年限", value: "", sensitivity: "review" },
  { key: "targetRole", label: "目标岗位", value: "Software / Data / BA", sensitivity: "review" },
  { key: "targetLocation", label: "目标地点", value: "中国大陆 / 新加坡 / 香港 / 澳洲", sensitivity: "review" },
  { key: "sourceChannel", label: "获知渠道", value: "公司官网/招聘平台/邮件提醒", sensitivity: "review" },
  { key: "referralName", label: "推荐人", value: "", sensitivity: "review" },
  {
    key: "workAuthorization",
    label: "工作权利回答",
    value: "我会根据岗位所在市场确认工作权利与签证要求，并在需要时提供真实材料。",
    market: "AU",
    sensitivity: "review"
  },
  {
    key: "visaSponsorship",
    label: "签证担保回答",
    value: "我会根据岗位要求确认是否需要签证支持，不会在未确认前自动填写。",
    sensitivity: "review"
  },
  {
    key: "nationality",
    label: "国籍/公民身份",
    value: "",
    sensitivity: "sensitive"
  },
  {
    key: "dateOfBirth",
    label: "出生日期",
    value: "",
    sensitivity: "sensitive"
  },
  {
    key: "identityNumber",
    label: "证件号码",
    value: "",
    sensitivity: "sensitive"
  }
];
