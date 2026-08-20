import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.14.0", (api) => {
  const siteSettings = api.container.lookup("service:site-settings");

  api.decorateCooked(
    ($elem, helper) => {
      if (isInstructionTopic(helper, siteSettings)) {
        return;
      }

      decorateParticipationStamp($elem, helper);
      decorateLotteryResult($elem);
      hydrateUserChips($elem);

      const rawHtml = $elem.html();
      const match = rawHtml.match(/\[抽奖\]([\s\S]*?)\[\/抽奖\]/);

      if (!match || $elem.find(".choujiang-card").length) {
        return;
      }

      const content = match[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
        .replace(/<\/?[^>]+>/g, "");
      const lines = content
        .split("\n")
        .map((line) => decodeHtml(line).trim())
        .filter(Boolean);
      const fields = {};
      const prizes = [];

      lines.forEach((line) => {
        const fieldMatch = line.match(/^([^：:]+)[：:](.*)$/);
        if (!fieldMatch) {
          return;
        }
        const key = fieldMatch[1].trim();
        const value = fieldMatch[2].trim();
        const prizeMatch = key.match(/^奖品(\d+)$/);
        if (prizeMatch) {
          const [label, prize, countText] = value.split("|").map((item) => item.trim());
          const count = Number.parseInt(countText, 10);
          if (label && prize && Number.isInteger(count) && count > 0) {
            prizes.push({ index: Number(prizeMatch[1]), label, prize, count });
          }
          return;
        }
        fields[key] = value;
      });
      prizes.sort((a, b) => a.index - b.index);
      const totalWinnerCount = prizes.length
        ? prizes.reduce((sum, item) => sum + item.count, 0)
        : fields["获奖人数"] || "";

      const instructionTopicId = Number(
        siteSettings.choujiang_instruction_topic_id || 0
      );
      const instructionUrl = instructionTopicId
        ? `/t/${instructionTopicId}`
        : "/t/topic/204";

      const prizeHtml = prizes.length
        ? `<div class="cj-prize-list">
            ${prizes.map((item) => `
              <div class="cj-prize-item">
                <strong>${escapeHtml(item.label)}</strong>
                <span class="cj-prize-name">${formatTextWithUserChips(item.prize)}</span>
                <span class="cj-prize-count">× ${escapeHtml(item.count)}</span>
              </div>`).join("")}
          </div>`
        : `<div class="cj-single-prize"><span>活动奖品：</span><strong>${formatTextWithUserChips(fields["活动奖品"] || "")}</strong></div>`;

      const html = `
        <div class="choujiang-card ${prizes.length ? "is-multi-prize" : ""}">
          <div class="cj-title">🎉 抽奖活动：${escapeHtml(fields["抽奖名称"] || "")}</div>
          ${prizeHtml}
          <ul class="cj-lottery-meta">
            <li><span>获奖人数：</span>${escapeHtml(totalWinnerCount)}</li>
            <li><span>开奖时间：</span>${escapeHtml(fields["开奖时间"] || "")}</li>
            <li><span>最低等级：</span>${escapeHtml(fields["最低等级"] || fields["最低信任等级"] || "TL0")}</li>
            <li><span>成就点数：</span>${escapeHtml(fields["成就点数"] || fields["最低积分"] || "0")}</li>
            <li><span>简单说明：</span>${escapeHtml(fields["简单说明"] || "")}</li>
          </ul>
          <div class="cj-footer">欢迎参与，祝大家好运！ <a href="${instructionUrl}" target="_blank" rel="noopener noreferrer">抽奖活动说明及发布方法</a></div>
        </div>
      `;

      $elem.html(
        rawHtml.replace(/\[抽奖\][\s\S]*?\[\/抽奖\]/, html)
      );
      hydrateUserChips($elem);
    },
    { id: "discourse-choujiang-card" }
  );
});

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function decodeHtml(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function isInstructionTopic(helper, siteSettings) {
  const instructionTopicId = Number(
    siteSettings.choujiang_instruction_topic_id || 0
  );

  if (!instructionTopicId) {
    return false;
  }

  const model = helper?.getModel?.();
  const modelTopicId = Number(
    model?.topic_id || model?.topicId || model?.topic?.id || model?.id || 0
  );

  if (modelTopicId === instructionTopicId) {
    return true;
  }

  const match = window.location.pathname.match(
    /^\/t\/(?:[^/]+\/)?(\d+)(?:\/|$)/
  );
  return Number(match?.[1] || 0) === instructionTopicId;
}



function decorateLotteryResult($elem) {
  if ($elem.find(".choujiang-result-card").length) {
    return;
  }

  const rawHtml = $elem.html();
  const match = rawHtml.match(/\[抽奖结果\]([\s\S]*?)\[\/抽奖结果\]/);
  if (!match) {
    return;
  }

  const content = match[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "");
  const lines = content
    .split("\n")
    .map((line) => decodeHtml(line).trim())
    .filter(Boolean);
  const fields = {};
  const winners = [];

  for (const line of lines) {
    const winner = line.match(/^中奖者(\d+)[：:](\-?\d+)\|([^|]*)\|([^|]*)\|(.*)$/);
    if (winner) {
      winners.push({
        rank: winner[1],
        userId: winner[2],
        username: winner[3],
        prizeLabel: winner[4],
        prize: winner[5],
      });
      continue;
    }

    const field = line.match(/^([^：:]+)[：:](.*)$/);
    if (field) {
      fields[field[1].trim()] = field[2].trim();
    }
  }

  if (!winners.length) {
    return;
  }

  const winnerHtml = winners
    .map(
      (winner) => `
        <div class="cj-result-winner">
          <div class="cj-result-rank">第 ${escapeHtml(winner.rank)} 名</div>
          <div class="cj-result-winner-main">
            ${userChipHtml(winner.username, "cj-result-user")}
          </div>
          <div class="cj-result-prize"><span>${escapeHtml(winner.prizeLabel || "活动奖品")}</span>${formatTextWithUserChips(winner.prize || fields["活动奖品"] || "-")}</div>
        </div>`
    )
    .join("");

  const resultHtml = `
    <div class="choujiang-result-card">
      <div class="cj-result-title">🎉 开奖结果：${escapeHtml(fields["抽奖名称"] || "抽奖活动")}</div>
      <ul class="cj-result-info">
        <li><span>开奖记录：</span><code>${escapeHtml(fields["开奖记录"] || "-")}</code></li>
      </ul>
      <div class="cj-result-winners">${winnerHtml}</div>
      <div class="cj-result-footer">恭喜以上中奖用户！</div>
    </div>`;

  $elem.html(rawHtml.replace(/\[抽奖结果\][\s\S]*?\[\/抽奖结果\]/, resultHtml));
  hydrateUserChips($elem);
}

const userAvatarCache = new Map();

function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@/, "");
}

function userChipHtml(username, extraClass = "") {
  const clean = normalizeUsername(username);
  if (!clean) {
    return "";
  }

  const href = `/u/${encodeURIComponent(clean)}`;
  return `<a class="cj-user-chip ${extraClass}" data-cj-username="${escapeHtml(clean)}" href="${href}">
    <span class="cj-user-avatar-placeholder" aria-hidden="true"></span>
    <span class="cj-user-chip-name">@${escapeHtml(clean)}</span>
  </a>`;
}

function formatTextWithUserChips(value) {
  const text = String(value ?? "");
  const mentionRegex = /(^|[\\s（(【[])(@([A-Za-z0-9_][A-Za-z0-9_.-]{0,59}))/g;
  let output = "";
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const prefix = match[1] || "";
    const fullMention = match[2];
    const username = match[3];
    const mentionStart = match.index + prefix.length;

    output += escapeHtml(text.slice(lastIndex, mentionStart));
    output += userChipHtml(username);
    lastIndex = mentionStart + fullMention.length;
  }

  output += escapeHtml(text.slice(lastIndex));
  return output;
}

async function fetchUserAvatar(username) {
  const key = normalizeUsername(username).toLowerCase();
  if (!key) {
    return null;
  }

  if (!userAvatarCache.has(key)) {
    userAvatarCache.set(
      key,
      fetch(`/u/${encodeURIComponent(username)}.json`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          const user = data?.user;
          if (!user?.avatar_template) {
            return null;
          }
          return {
            username: user.username || username,
            avatarUrl: user.avatar_template.replace("{size}", "48"),
          };
        })
        .catch(() => null)
    );
  }

  return userAvatarCache.get(key);
}

function hydrateUserChips($elem) {
  const root = $elem?.[0];
  if (!root) {
    return;
  }

  root.querySelectorAll(".cj-user-chip[data-cj-username]").forEach((chip) => {
    if (chip.dataset.cjAvatarLoaded === "1") {
      return;
    }
    chip.dataset.cjAvatarLoaded = "1";
    const username = chip.dataset.cjUsername;

    fetchUserAvatar(username).then((user) => {
      if (!user || !chip.isConnected) {
        return;
      }

      const placeholder = chip.querySelector(".cj-user-avatar-placeholder");
      if (placeholder && user.avatarUrl) {
        const img = document.createElement("img");
        img.className = "cj-user-avatar";
        img.src = user.avatarUrl;
        img.alt = "";
        img.loading = "lazy";
        img.width = 24;
        img.height = 24;
        placeholder.replaceWith(img);
      }

      const name = chip.querySelector(".cj-user-chip-name");
      if (name && user.username) {
        name.textContent = `@${user.username}`;
      }
    });
  });
}

function decorateParticipationStamp($elem, helper) {
  if ($elem.find(".choujiang-participation-stamp").length) {
    return;
  }

  const winnerMatch = $elem.text().match(/第\s*(\d+)\s*位中奖者/);
  if (winnerMatch) {
    addParticipationStamp($elem, {
      className: "is-winner",
      label: `恭喜中奖，第 ${winnerMatch[1]} 位中奖者`,
      text: "恭喜中奖",
    });
    return;
  }

  const model = helper?.getModel?.();
  const status =
    model?.choujiang_participation || model?.choujiangParticipation;
  if (!status) {
    return;
  }

  const failures = status.failures || [];
  const failureCodes = new Set(failures.map((failure) => failure.code));
  const labels = [];

  if (status.eligible) {
    if (status.first_participation === false) {
      return;
    }
    labels.push("参与成功");
  } else {
    if (failureCodes.has("trust_level")) {
      labels.push("等级不足");
    }
    if (failureCodes.has("points")) {
      labels.push("成就点数不足");
    }
    if (!labels.length) {
      labels.push("无法参与");
    }
  }

  addParticipationStamp($elem, {
    className: status.eligible ? "is-eligible" : "is-ineligible",
    label: labels.join("，"),
    text: labels.join(" · "),
  });
}

function addParticipationStamp($elem, { className, label, text }) {
  const stamp = document.createElement("div");
  stamp.className = `choujiang-participation-stamp ${className}`;
  stamp.setAttribute("role", "status");
  stamp.setAttribute("aria-label", label);
  stamp.textContent = text;

  $elem.addClass("has-choujiang-participation-stamp");
  $elem.prepend(stamp);
}
