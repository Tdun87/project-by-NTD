(() => {
  "use strict";

  const AUTH_USERS_KEY = "vn-anti-scam-auth-users";
  const AUTH_SESSION_KEY = "vn-anti-scam-auth-session";

  // Strict RFC 5322 email pattern (local@domain.tld)
  const STRICT_EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  // Active 10-digit Vietnam mobile prefixes:
  // 032-039, 052, 055, 056, 058, 059, 070, 076-079, 081-089, 090-094, 096-099
  const VN_MOBILE_REGEX =
    /^(?:03[2-9]|05[25689]|07[06-9]|08[1-9]|09[0-46-9])\d{7}$/;

  const RESERVED_NON_REAL_TLDS = new Set([
    "test",
    "example",
    "invalid",
    "localhost",
    "local",
    "internal",
    "lan",
    "home",
    "corp",
    "localdomain",
    "onion",
    "arpa",
  ]);

  const RESERVED_EXAMPLE_DOMAINS = new Set([
    "example.com",
    "example.net",
    "example.org",
    "example.edu",
    "test.com",
    "domain.com",
  ]);

  const DISPOSABLE_DOMAINS = new Set([
    "10minutemail.com",
    "10minutemail.net",
    "1secmail.com",
    "1secmail.net",
    "1secmail.org",
    "33mail.com",
    "anonbox.net",
    "binkmail.com",
    "bobmail.info",
    "burnermail.io",
    "byom.de",
    "crazymailing.com",
    "discard.email",
    "dispostable.com",
    "dropmail.me",
    "e4ward.com",
    "emailondeck.com",
    "fakeinbox.com",
    "filzmail.com",
    "getairmail.com",
    "getnada.com",
    "grr.la",
    "guerrillamail.biz",
    "guerrillamail.com",
    "guerrillamail.de",
    "guerrillamail.info",
    "guerrillamail.net",
    "guerrillamail.org",
    "guerrillamailblock.com",
    "harakirimail.com",
    "inboxbear.com",
    "incognitomail.org",
    "jetable.org",
    "klzlk.com",
    "linshi-email.com",
    "mail-temporaire.fr",
    "mailcatch.com",
    "maildrop.cc",
    "mailexpire.com",
    "mailinator.com",
    "mailinator.net",
    "mailnesia.com",
    "mintemail.com",
    "moakt.com",
    "mohmal.com",
    "mvrht.net",
    "mytemp.email",
    "nada.email",
    "nwldx.com",
    "owlpic.com",
    "pokemail.net",
    "sharklasers.com",
    "soodonims.com",
    "spam4.me",
    "spambox.us",
    "spamgourmet.com",
    "temp-mail.io",
    "temp-mail.org",
    "tempail.com",
    "tempinbox.com",
    "tempmail.com",
    "tempmail.net",
    "tempmail.org",
    "tempr.email",
    "thankyou2010.com",
    "throwawaymail.com",
    "tmail.ws",
    "tmailinator.com",
    "tmpmail.net",
    "tmpmail.org",
    "trashmail.com",
    "trashmail.de",
    "trashmail.net",
    "trashmail.org",
    "wegwerfmail.de",
    "yomail.info",
    "yopmail.com",
    "yopmail.fr",
    "yopmail.net",
    "zippymail.info",
  ]);

  function isDisposableOrReservedDomain(domain) {
    const normalized = domain.toLowerCase();
    if (RESERVED_EXAMPLE_DOMAINS.has(normalized)) return true;
    if (DISPOSABLE_DOMAINS.has(normalized)) return true;
    for (const blocked of DISPOSABLE_DOMAINS) {
      if (normalized.endsWith(`.${blocked}`)) return true;
    }
    return false;
  }

  const EMAIL_FORMAT_ERROR =
    "Email không hợp lệ. Hãy nhập đúng định dạng (ví dụ: ten@domain.vn).";
  const EMAIL_DOMAIN_ERROR =
    "Email không hợp lệ. Tên miền này không được chấp nhận.";
  const EMAIL_DISPOSABLE_ERROR =
    "Không chấp nhận email tạm thời hoặc tên miền dùng một lần.";
  const PHONE_FORMAT_ERROR =
    "Số điện thoại không hợp lệ. Chỉ chấp nhận số di động Việt Nam đúng 10 chữ số đang hoạt động.";

  function inspectEmail(rawValue) {
    const email = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!email || email.length > 254 || !STRICT_EMAIL_REGEX.test(email)) {
      return EMAIL_FORMAT_ERROR;
    }

    const atIndex = email.lastIndexOf("@");
    const localPart = email.slice(0, atIndex);
    const domainPart = email.slice(atIndex + 1).toLowerCase();

    if (
      localPart.length < 1 ||
      localPart.length > 64 ||
      localPart.startsWith(".") ||
      localPart.endsWith(".") ||
      localPart.includes("..")
    ) {
      return EMAIL_FORMAT_ERROR;
    }

    const labels = domainPart.split(".");
    if (labels.length < 2) return EMAIL_FORMAT_ERROR;

    const tld = labels[labels.length - 1];
    const validAlphaTld = /^[a-z]{2,24}$/.test(tld);
    const validPunycodeTld = /^xn--[a-z0-9]{2,59}$/.test(tld);
    if (!validAlphaTld && !validPunycodeTld) return EMAIL_FORMAT_ERROR;
    if (RESERVED_NON_REAL_TLDS.has(tld) || RESERVED_EXAMPLE_DOMAINS.has(domainPart)) {
      return EMAIL_DOMAIN_ERROR;
    }
    if (isDisposableOrReservedDomain(domainPart)) return EMAIL_DISPOSABLE_ERROR;

    return "";
  }

  function isValidStrictEmail(rawValue) {
    return inspectEmail(rawValue) === "";
  }

  function normalizeVnMobilePhone(rawValue) {
    if (typeof rawValue !== "string") return "";
    let digits = rawValue.replace(/[\s().-]+/g, "");
    if (digits.startsWith("+84")) {
      digits = `0${digits.slice(3)}`;
    } else if (digits.startsWith("84") && digits.length === 11) {
      digits = `0${digits.slice(2)}`;
    }
    return digits;
  }

  function isValidVnMobilePhone(rawValue) {
    const phone = normalizeVnMobilePhone(rawValue);
    return VN_MOBILE_REGEX.test(phone);
  }

  function validateIdentifier(rawValue) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) {
      return {
        valid: false,
        type: null,
        normalized: "",
        error: "Vui lòng nhập Email hoặc Số điện thoại.",
      };
    }

    if (value.includes("@")) {
      const emailError = inspectEmail(value);
      if (emailError) {
        return {
          valid: false,
          type: "email",
          normalized: "",
          error: emailError,
        };
      }
      return {
        valid: true,
        type: "email",
        normalized: value.toLowerCase(),
        error: "",
      };
    }

    const looksLikePhone =
      /^[+\d\s().-]+$/.test(value) ||
      /^(?:0|\+?84|\d)/.test(value);

    if (looksLikePhone) {
      const normalizedPhone = normalizeVnMobilePhone(value);
      if (!VN_MOBILE_REGEX.test(normalizedPhone)) {
        return {
          valid: false,
          type: "phone",
          normalized: "",
          error: PHONE_FORMAT_ERROR,
        };
      }
      return {
        valid: true,
        type: "phone",
        normalized: normalizedPhone,
        error: "",
      };
    }

    return {
      valid: false,
      type: "email",
      normalized: "",
      error: EMAIL_FORMAT_ERROR,
    };
  }

  function evaluatePasswordStrength(password) {
    const value = typeof password === "string" ? password : "";
    if (!value) {
      return {
        level: "empty",
        label: "Yếu",
        allowed: false,
        rules: {
          length: false,
          upper: false,
          lower: false,
          number: false,
          special: false,
          noSpace: false,
        },
      };
    }

    const rules = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      number: /\d/.test(value),
      special: /[^A-Za-z0-9\s]/.test(value),
      noSpace: value.length > 0 && !/\s/.test(value),
    };

    const allBaselineMet =
      rules.length &&
      rules.upper &&
      rules.lower &&
      rules.number &&
      rules.special &&
      rules.noSpace;

    if (!allBaselineMet) {
      return {
        level: "weak",
        label: "Yếu",
        allowed: false,
        rules,
      };
    }

    const uniqueCount = new Set(value).size;
    const upperCount = (value.match(/[A-Z]/g) || []).length;
    const digitCount = (value.match(/\d/g) || []).length;
    const specialCount = (value.match(/[^A-Za-z0-9\s]/g) || []).length;

    const isStrong =
      (value.length >= 12 && uniqueCount >= 8) ||
      (value.length >= 10 &&
        upperCount >= 2 &&
        digitCount >= 2 &&
        specialCount >= 2);

    return {
      level: isStrong ? "strong" : "medium",
      label: isStrong ? "Mạnh" : "Trung bình",
      allowed: true,
      rules,
    };
  }

  function getPasswordValidationError(password, evaluation) {
    if (!password) {
      return "Vui lòng nhập mật khẩu.";
    }
    if (!evaluation.rules.noSpace) {
      return "Mật khẩu không được chứa khoảng trắng.";
    }
    if (!evaluation.allowed) {
      return "Mật khẩu yếu (không được phép). Cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.";
    }
    return "";
  }

  async function sha256Hex(input) {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Trình duyệt không hỗ trợ Web Crypto API (SHA-256). Hãy mở trang qua HTTPS hoặc localhost.");
    }
    const encoded = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function createSaltHex(byteLength = 16) {
    if (!globalThis.crypto?.getRandomValues) {
      throw new Error("Trình duyệt không hỗ trợ tạo chuỗi ngẫu nhiên an toàn.");
    }
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function readStoredUsers() {
    try {
      const raw = localStorage.getItem(AUTH_USERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter(
            (item) =>
              item &&
              typeof item.identifier === "string" &&
              typeof item.passwordHash === "string"
          )
        : [];
    } catch {
      return [];
    }
  }

  function saveStoredUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  }

  async function registerAccount(identifierInfo, password) {
    const users = readStoredUsers();
    const exists = users.some((user) => user.identifier === identifierInfo.normalized);
    if (exists) {
      throw new Error("Email hoặc Số điện thoại này đã được đăng ký.");
    }

    const salt = createSaltHex(16);
    const passwordHash = await sha256Hex(`${salt}:${password}`);

    users.push({
      identifier: identifierInfo.normalized,
      identifierType: identifierInfo.type,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    saveStoredUsers(users);
  }

  async function authenticateAccount(identifierInfo, password) {
    const users = readStoredUsers();
    const matchedUser = users.find(
      (user) => user.identifier === identifierInfo.normalized
    );
    if (!matchedUser) {
      return { ok: false, error: "Email/Số điện thoại hoặc mật khẩu không chính xác." };
    }

    const candidateInput = matchedUser.salt
      ? `${matchedUser.salt}:${password}`
      : password;
    const candidateHash = await sha256Hex(candidateInput);
    if (candidateHash !== matchedUser.passwordHash) {
      return { ok: false, error: "Email/Số điện thoại hoặc mật khẩu không chính xác." };
    }

    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        identifier: matchedUser.identifier,
        identifierType: matchedUser.identifierType,
        loggedInAt: new Date().toISOString(),
      })
    );

    return { ok: true, user: matchedUser };
  }

  async function resolveHomeUrl() {
    if (window.location.protocol === "file:") {
      return "./index.html";
    }
    try {
      const res = await fetch("./index.html", { method: "HEAD" });
      if (res.ok) return "./index.html";
      const demoRes = await fetch("./index.html", { method: "HEAD" });
      if (demoRes.ok) return "./index.html";
    } catch {
      // Fallback to root path on static hosting
    }
    return "/";
  }

  function initializeAuthPage() {
    const form = document.querySelector("#auth-form");
    if (!(form instanceof HTMLFormElement)) return;

    const pillLogin = document.querySelector("#pill-login");
    const pillRegister = document.querySelector("#pill-register");
    const authTitle = document.querySelector("#auth-title");
    const authSubtitle = document.querySelector("#auth-subtitle");
    const identifierInput = document.querySelector("#auth-identifier");
    const passwordInput = document.querySelector("#auth-password");
    const togglePasswordBtn = document.querySelector("#toggle-password");
    const identifierError = document.querySelector("#identifier-error");
    const passwordError = document.querySelector("#password-error");
    const strengthPanel = document.querySelector("#strength-panel");
    const strengthLabel = document.querySelector("#strength-label");
    const strengthFill = document.querySelector("#strength-fill");
    const authFeedback = document.querySelector("#auth-feedback");
    const submitBtn = document.querySelector("#auth-submit");

    let homeUrl = "./index.html";
    resolveHomeUrl().then((resolved) => {
      homeUrl = resolved;
      document.querySelectorAll("[data-home-link]").forEach((anchor) => {
        anchor.setAttribute("href", resolved);
      });
    });

    const ruleItems = {
      length: document.querySelector("#rule-length"),
      upper: document.querySelector("#rule-upper"),
      lower: document.querySelector("#rule-lower"),
      number: document.querySelector("#rule-number"),
      special: document.querySelector("#rule-special"),
      noSpace: document.querySelector("#rule-nospace"),
    };

    let currentMode = "login";
    let identifierTouched = false;
    let redirecting = false;

    const syncPasswordVisibility = (revealed) => {
      passwordInput.type = revealed ? "text" : "password";
      togglePasswordBtn.classList.toggle("is-revealed", revealed);
      togglePasswordBtn.setAttribute("aria-pressed", String(revealed));
      togglePasswordBtn.setAttribute("aria-label", revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu");
    };

    const clearFeedback = () => {
      authFeedback.hidden = true;
      authFeedback.className = "auth-feedback";
      authFeedback.textContent = "";
    };

    const showFeedback = (type, message) => {
      authFeedback.className = `auth-feedback ${type}`;
      authFeedback.textContent = message;
      authFeedback.hidden = false;
    };

    const setFieldError = (input, errorEl, message) => {
      errorEl.textContent = message;
      input.classList.toggle("is-invalid", Boolean(message));
      input.setAttribute("aria-invalid", String(Boolean(message)));
    };

    const updateStrengthMeter = () => {
      const evaluation = evaluatePasswordStrength(passwordInput.value);
      strengthLabel.textContent = evaluation.label;
      strengthLabel.dataset.level = evaluation.level;
      strengthFill.dataset.level = evaluation.level;

      for (const [key, item] of Object.entries(ruleItems)) {
        if (item) {
          item.classList.toggle("met", Boolean(evaluation.rules[key]));
        }
      }
      return evaluation;
    };

    const setMode = (mode, options = { preserveFeedback: false }) => {
      currentMode = mode === "register" ? "register" : "login";
      const isRegister = currentMode === "register";

      pillLogin.classList.toggle("active", !isRegister);
      pillLogin.setAttribute("aria-selected", String(!isRegister));
      pillRegister.classList.toggle("active", isRegister);
      pillRegister.setAttribute("aria-selected", String(isRegister));

      authTitle.textContent = isRegister ? "Đăng ký tài khoản" : "Đăng nhập tài khoản";
      authSubtitle.textContent = isRegister
        ? "Tạo tài khoản bảo mật với mật khẩu mạnh và mã hóa SHA-256 trên thiết bị."
        : "Xác thực bằng Email hoặc Số điện thoại Việt Nam để truy cập hệ thống.";
      submitBtn.textContent = isRegister ? "Đăng ký" : "Đăng nhập";
      passwordInput.setAttribute(
        "autocomplete",
        isRegister ? "new-password" : "current-password"
      );

      strengthPanel.hidden = !isRegister;
      identifierTouched = false;
      syncPasswordVisibility(false);
      setFieldError(identifierInput, identifierError, "");
      setFieldError(passwordInput, passwordError, "");
      if (!options.preserveFeedback) clearFeedback();

      if (isRegister) updateStrengthMeter();
    };

    pillLogin.addEventListener("click", () => setMode("login"));
    pillRegister.addEventListener("click", () => setMode("register"));

    togglePasswordBtn.addEventListener("click", () => {
      syncPasswordVisibility(passwordInput.type !== "text");
    });

    const showIdentifierError = () => {
      const check = validateIdentifier(identifierInput.value);
      setFieldError(identifierInput, identifierError, check.valid ? "" : check.error);
      return check;
    };

    identifierInput.addEventListener("blur", () => {
      if (!identifierInput.value.trim()) return;
      identifierTouched = true;
      showIdentifierError();
    });

    identifierInput.addEventListener("input", () => {
      clearFeedback();
      if (!identifierTouched) {
        if (identifierError.textContent) {
          setFieldError(identifierInput, identifierError, "");
        }
        return;
      }
      if (!identifierInput.value.trim()) {
        setFieldError(identifierInput, identifierError, "");
        return;
      }
      showIdentifierError();
    });

    passwordInput.addEventListener("input", () => {
      if (passwordError.textContent) {
        setFieldError(passwordInput, passwordError, "");
      }
      clearFeedback();
      if (currentMode === "register") {
        updateStrengthMeter();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearFeedback();

      const idCheck = validateIdentifier(identifierInput.value);
      if (!idCheck.valid) {
        setFieldError(identifierInput, identifierError, idCheck.error);
        identifierInput.focus();
        return;
      }
      setFieldError(identifierInput, identifierError, "");

      const password = passwordInput.value;
      if (currentMode === "register") {
        const strength = updateStrengthMeter();
        const pwError = getPasswordValidationError(password, strength);
        if (pwError) {
          setFieldError(passwordInput, passwordError, pwError);
          passwordInput.focus();
          return;
        }
      } else if (!password) {
        setFieldError(passwordInput, passwordError, "Vui lòng nhập mật khẩu.");
        passwordInput.focus();
        return;
      }
      setFieldError(passwordInput, passwordError, "");

      submitBtn.disabled = true;
      try {
        if (currentMode === "register") {
          await registerAccount(idCheck, password);
          passwordInput.value = "";
          setMode("login", { preserveFeedback: true });
          showFeedback(
            "success",
            "Đăng ký thành công. Mật khẩu đã được băm SHA-256 trên thiết bị. Vui lòng đăng nhập để tiếp tục."
          );
          passwordInput.focus();
          return;
        }

        const loginResult = await authenticateAccount(idCheck, password);
        if (!loginResult.ok) {
          showFeedback("error", loginResult.error);
          passwordInput.focus();
          return;
        }

        redirecting = true;
        submitBtn.textContent = "Đã xác thực";
        showFeedback("success", "Đăng nhập thành công. Đang chuyển về trang chủ…");
        window.setTimeout(() => {
          window.location.assign(homeUrl);
        }, 850);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Đã xảy ra lỗi khi xử lý xác thực.";
        showFeedback("error", message);
      } finally {
        if (!redirecting) submitBtn.disabled = false;
      }
    });

    setMode("login");
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeAuthPage, { once: true });
    } else {
      initializeAuthPage();
    }
  }

  if (typeof globalThis !== "undefined") {
    globalThis.VNAntiScamAuth = {
      validateIdentifier,
      isValidStrictEmail,
      isValidVnMobilePhone,
      normalizeVnMobilePhone,
      evaluatePasswordStrength,
      sha256Hex,
    };
  }
})();