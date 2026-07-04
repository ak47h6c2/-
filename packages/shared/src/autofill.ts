export type AutofillSensitivity = "safe" | "review" | "sensitive";

export type CandidateFieldKey =
  | "givenName"
  | "familyName"
  | "preferredName"
  | "chineseName"
  | "fullName"
  | "email"
  | "phone"
  | "wechatId"
  | "addressLine1"
  | "city"
  | "state"
  | "country"
  | "postalCode"
  | "linkedInUrl"
  | "githubUrl"
  | "portfolioUrl"
  | "school"
  | "degree"
  | "major"
  | "graduationMonth"
  | "graduationYear"
  | "salaryExpectation"
  | "noticePeriod"
  | "availableStartDate"
  | "relocation"
  | "workExperienceYears"
  | "targetRole"
  | "targetLocation"
  | "sourceChannel"
  | "referralName"
  | "nationality"
  | "dateOfBirth"
  | "identityNumber"
  | "workAuthorization"
  | "visaSponsorship";

export type FieldRule = {
  key: CandidateFieldKey;
  label: string;
  sensitivity: AutofillSensitivity;
  patterns: string[];
};

export const fieldRules: FieldRule[] = [
  {
    key: "givenName",
    label: "名",
    sensitivity: "safe",
    patterns: ["first name", "given name", "preferred first name", "名", "名字"]
  },
  {
    key: "preferredName",
    label: "常用名/英文名",
    sensitivity: "safe",
    patterns: ["preferred name", "preferred english name", "known as", "english name", "英文名", "常用名"]
  },
  {
    key: "familyName",
    label: "姓",
    sensitivity: "safe",
    patterns: ["last name", "family name", "surname", "姓", "姓氏"]
  },
  {
    key: "chineseName",
    label: "中文姓名",
    sensitivity: "safe",
    patterns: ["chinese name", "name in chinese", "中文姓名", "中文名"]
  },
  {
    key: "fullName",
    label: "姓名",
    sensitivity: "safe",
    patterns: ["full name", "legal name", "姓名", "中文名", "英文名"]
  },
  {
    key: "email",
    label: "邮箱",
    sensitivity: "safe",
    patterns: ["email", "e-mail", "邮箱", "电子邮件", "邮件地址"]
  },
  {
    key: "phone",
    label: "电话",
    sensitivity: "safe",
    patterns: ["phone", "mobile", "telephone", "手机", "电话", "联系电话"]
  },
  {
    key: "wechatId",
    label: "微信",
    sensitivity: "review",
    patterns: ["wechat", "weixin", "微信", "微信号"]
  },
  {
    key: "addressLine1",
    label: "地址",
    sensitivity: "safe",
    patterns: ["address line 1", "street address", "address", "住址", "地址", "通讯地址"]
  },
  {
    key: "city",
    label: "城市",
    sensitivity: "safe",
    patterns: ["city", "suburb", "城市", "所在城市", "现居地"]
  },
  {
    key: "state",
    label: "州/省",
    sensitivity: "safe",
    patterns: ["state", "province", "territory", "州", "省", "省份"]
  },
  {
    key: "country",
    label: "国家/地区",
    sensitivity: "safe",
    patterns: ["country", "region", "国家", "地区", "国家/地区"]
  },
  {
    key: "postalCode",
    label: "邮编",
    sensitivity: "safe",
    patterns: ["postal code", "postcode", "zip", "邮编", "邮政编码"]
  },
  {
    key: "linkedInUrl",
    label: "LinkedIn",
    sensitivity: "safe",
    patterns: ["linkedin", "linked in", "领英"]
  },
  {
    key: "githubUrl",
    label: "GitHub",
    sensitivity: "safe",
    patterns: ["github", "git hub"]
  },
  {
    key: "portfolioUrl",
    label: "作品集",
    sensitivity: "safe",
    patterns: ["portfolio", "personal website", "website", "个人网站", "作品集"]
  },
  {
    key: "school",
    label: "学校",
    sensitivity: "safe",
    patterns: ["school", "university", "institution", "学校", "院校", "大学"]
  },
  {
    key: "degree",
    label: "学位",
    sensitivity: "safe",
    patterns: ["degree", "qualification", "学历", "学位"]
  },
  {
    key: "major",
    label: "专业",
    sensitivity: "safe",
    patterns: ["major", "field of study", "discipline", "专业", "研究方向"]
  },
  {
    key: "graduationMonth",
    label: "毕业月份",
    sensitivity: "safe",
    patterns: ["graduation month", "completion month", "毕业月份"]
  },
  {
    key: "graduationYear",
    label: "毕业年份",
    sensitivity: "safe",
    patterns: ["graduation year", "completion year", "毕业年份", "毕业时间"]
  },
  {
    key: "salaryExpectation",
    label: "期望薪资",
    sensitivity: "review",
    patterns: ["salary", "expected compensation", "expected pay", "期望薪资", "薪资要求"]
  },
  {
    key: "noticePeriod",
    label: "到岗时间",
    sensitivity: "review",
    patterns: ["notice period", "availability", "入职时间", "到岗"]
  },
  {
    key: "availableStartDate",
    label: "可入职日期",
    sensitivity: "review",
    patterns: ["available start date", "start date", "earliest start", "available from", "可入职日期", "最早到岗"]
  },
  {
    key: "relocation",
    label: "是否接受调剂/异地",
    sensitivity: "review",
    patterns: ["relocate", "relocation", "willing to move", "是否接受调剂", "是否接受异地"]
  },
  {
    key: "workExperienceYears",
    label: "工作/项目年限",
    sensitivity: "review",
    patterns: ["years of experience", "work experience", "experience years", "工作年限", "项目经验", "经验年限"]
  },
  {
    key: "targetRole",
    label: "目标岗位",
    sensitivity: "review",
    patterns: ["desired role", "target role", "preferred position", "期望岗位", "目标岗位", "意向岗位"]
  },
  {
    key: "targetLocation",
    label: "目标地点",
    sensitivity: "review",
    patterns: ["preferred location", "target location", "desired location", "期望城市", "目标地点", "意向城市"]
  },
  {
    key: "sourceChannel",
    label: "获知渠道",
    sensitivity: "review",
    patterns: ["how did you hear", "source", "application source", "referral source", "获知渠道", "招聘渠道", "信息来源"]
  },
  {
    key: "referralName",
    label: "推荐人",
    sensitivity: "review",
    patterns: ["referral", "referrer", "employee referred", "推荐人", "内推人"]
  },
  {
    key: "nationality",
    label: "国籍/公民身份",
    sensitivity: "sensitive",
    patterns: ["nationality", "citizenship", "citizen", "国籍", "公民身份"]
  },
  {
    key: "dateOfBirth",
    label: "出生日期",
    sensitivity: "sensitive",
    patterns: ["date of birth", "birth date", "birthday", "dob", "出生日期", "生日"]
  },
  {
    key: "identityNumber",
    label: "证件号码",
    sensitivity: "sensitive",
    patterns: ["passport", "identity number", "national id", "id number", "身份证", "护照", "证件号码"]
  },
  {
    key: "workAuthorization",
    label: "工作权利",
    sensitivity: "review",
    patterns: ["authorized to work", "right to work", "work rights", "工作权利", "工作许可"]
  },
  {
    key: "visaSponsorship",
    label: "签证担保",
    sensitivity: "review",
    patterns: ["sponsorship", "visa sponsor", "require visa", "签证担保", "工签"]
  }
];

export function normalizeFieldText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectCandidateField(text: string) {
  const normalized = normalizeFieldText(text);

  for (const rule of fieldRules) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern.toLowerCase()))) {
      return rule;
    }
  }

  return null;
}
