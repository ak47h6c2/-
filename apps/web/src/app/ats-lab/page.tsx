const labs = {
  workday: {
    title: "Workday 模拟表单",
    vendor: "Workday",
    className: "workday-shell",
    action: "/ats-lab?type=workday"
  },
  greenhouse: {
    title: "Greenhouse 模拟表单",
    vendor: "Greenhouse",
    className: "application--container",
    action: "/ats-lab?type=greenhouse"
  },
  lever: {
    title: "Lever 模拟表单",
    vendor: "Lever",
    className: "application-form",
    action: "/ats-lab?type=lever"
  },
  smartrecruiters: {
    title: "SmartRecruiters 模拟表单",
    vendor: "SmartRecruiters",
    className: "job-application",
    action: "/ats-lab?type=smartrecruiters"
  },
  ashby: {
    title: "Ashby 模拟表单",
    vendor: "Ashby",
    className: "ashby-job-posting",
    action: "/ats-lab?type=ashby"
  },
  bamboohr: {
    title: "BambooHR 模拟表单",
    vendor: "BambooHR",
    className: "bamboohr-application BambooHR-ATS-board",
    action: "/ats-lab?type=bamboohr"
  },
  company: {
    title: "公司官网模拟表单",
    vendor: "通用表单",
    className: "company-apply-form",
    action: "/ats-lab?type=company"
  }
};

type LabKey = keyof typeof labs;

export default async function AtsLabPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const params = await searchParams;
  const type = labs[params.type as LabKey] ? (params.type as LabKey) : "workday";
  const lab = labs[type];

  return (
    <main className="ats-lab-page" data-careerpilot-ats={lab.vendor}>
      <nav className="ats-lab-tabs" aria-label="ATS 测试表单">
        {Object.entries(labs).map(([key, item]) => (
          <a className={key === type ? "active" : ""} href={`/ats-lab?type=${key}`} key={key}>
            {item.vendor}
          </a>
        ))}
      </nav>

      <section className={`ats-lab-panel ${lab.className}`}>
        <div>
          <span>CareerPilot ATS Lab</span>
          <h1>{lab.title}</h1>
        </div>

        <form action={lab.action} method="post">
          <input name="csrf_token" type="hidden" value="careerpilot-lab-token" />
          <div className="ats-lab-grid">
            <label>
              First name
              <input autoComplete="given-name" data-automation-id="firstName" name="first_name" placeholder="First name" required suppressHydrationWarning />
            </label>
            <label>
              Last name
              <input autoComplete="family-name" data-automation-id="lastName" name="last_name" placeholder="Last name" required suppressHydrationWarning />
            </label>
            <label>
              Email
              <input autoComplete="email" data-qa="email-input" name="email" placeholder="you@example.com" required suppressHydrationWarning type="email" />
            </label>
            <label>
              Phone
              <input autoComplete="tel" name="phone" placeholder="+61 ..." suppressHydrationWarning type="tel" />
            </label>
            <label>
              Preferred English name
              <input name="preferred_name" placeholder="Preferred name / English name" suppressHydrationWarning />
            </label>
            <label>
              WeChat
              <input name="wechat_id" placeholder="WeChat / 微信号" suppressHydrationWarning />
            </label>
            <label>
              Country
              <select name="country" required suppressHydrationWarning>
                <option value="">Select country</option>
                <option>Australia</option>
                <option>China</option>
                <option>Singapore</option>
                <option>Hong Kong</option>
              </select>
            </label>
            <label>
              City
              <input name="city" placeholder="Sydney / Shanghai / Singapore" suppressHydrationWarning />
            </label>
            <label>
              University
              <input data-test="school" name="school" placeholder="University" suppressHydrationWarning />
            </label>
            <label>
              Degree
              <input name="degree" placeholder="Degree" suppressHydrationWarning />
            </label>
            <label>
              Major
              <input name="major" placeholder="Major" suppressHydrationWarning />
            </label>
            <label>
              Graduation year
              <input name="graduation_year" placeholder="2027" suppressHydrationWarning />
            </label>
            <label>
              LinkedIn
              <input name="linkedin_url" placeholder="https://linkedin.com/in/..." suppressHydrationWarning type="url" />
            </label>
            <label>
              GitHub
              <input name="github_url" placeholder="https://github.com/..." suppressHydrationWarning type="url" />
            </label>
            <label className="full-span">
              Cover letter
              <textarea name="cover_letter" placeholder="Paste a short cover letter" rows={5} suppressHydrationWarning />
            </label>
            <label>
              Expected salary
              <input name="salary_expectation" placeholder="Expected salary / 期望薪资" suppressHydrationWarning />
            </label>
            <label>
              Available start date
              <input name="available_start_date" placeholder="Start date / 可入职时间" suppressHydrationWarning type="date" />
            </label>
            <label>
              How did you hear about us?
              <input name="application_source" placeholder="Application source / 招聘渠道" suppressHydrationWarning />
            </label>
            <label>
              Referral name
              <input name="referral_name" placeholder="Employee referral / 推荐人" suppressHydrationWarning />
            </label>
            <label>
              Date of birth
              <input name="date_of_birth" placeholder="Date of birth" suppressHydrationWarning type="date" />
            </label>
            <label>
              Passport or ID number
              <input name="identity_number" placeholder="Passport / ID number" suppressHydrationWarning />
            </label>
            <label className="full-span">
              Resume upload
              <input name="resume_upload" suppressHydrationWarning type="file" />
            </label>
            <fieldset className="full-span">
              <legend>Do you have work authorization?</legend>
              <label>
                <input name="work_authorization" type="radio" value="yes" suppressHydrationWarning />
                Yes
              </label>
              <label>
                <input name="work_authorization" type="radio" value="no" suppressHydrationWarning />
                No
              </label>
            </fieldset>
            <fieldset className="full-span">
              <legend>Do you require visa sponsorship?</legend>
              <label>
                <input name="visa_sponsorship" type="radio" value="yes" suppressHydrationWarning />
                Yes
              </label>
              <label>
                <input name="visa_sponsorship" type="radio" value="no" suppressHydrationWarning />
                No
              </label>
            </fieldset>
            <fieldset className="full-span">
              <legend>Application checklist</legend>
              <label>
                <input name="confirm_truth" type="checkbox" value="yes" suppressHydrationWarning />
                I confirm the information is accurate
              </label>
            </fieldset>
          </div>

          <button type="button">Submit disabled in lab</button>
        </form>
      </section>
    </main>
  );
}
