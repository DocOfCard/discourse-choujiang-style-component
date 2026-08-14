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

      lines.forEach((line) => {
        const fieldMatch = line.match(/^([^：:]+)[：:](.*)$/);
        if (fieldMatch) {
          fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
        }
      });

      const instructionTopicId = Number(
        siteSettings.choujiang_instruction_topic_id || 0
      );
      const instructionUrl = instructionTopicId
        ? `/t/${instructionTopicId}`
        : "/t/topic/204";

      const html = `
        <div class="choujiang-card">
          <div class="cj-title">🎉 抽奖活动：${escapeHtml(fields["抽奖名称"] || "")}</div>
          <ul>
            <li><span>活动奖品：</span>${escapeHtml(fields["活动奖品"] || "")}</li>
            <li><span>获奖人数：</span>${escapeHtml(fields["获奖人数"] || "")}</li>
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
    const winner = line.match(/^中奖者(\d+)[：:](\-?\d+)\|([^|]*)\|(.*)$/);
    if (winner) {
      winners.push({
        rank: winner[1],
        userId: winner[2],
        username: winner[3],
        prize: winner[4],
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
            <a class="cj-result-user" href="/u/${encodeURIComponent(winner.username)}">@${escapeHtml(winner.username)}</a>
            <span class="cj-result-user-id">ID ${escapeHtml(winner.userId)}</span>
          </div>
          <div class="cj-result-prize"><span>活动奖品</span>${escapeHtml(winner.prize || fields["活动奖品"] || "-")}</div>
        </div>`
    )
    .join("");

  const resultHtml = `
    <div class="choujiang-result-card">
      <div class="cj-result-title">🎉 开奖结果：${escapeHtml(fields["抽奖名称"] || "抽奖活动")}</div>
      <ul class="cj-result-info">
        <li><span>开奖记录：</span><code>${escapeHtml(fields["开奖记录"] || "-")}</code></li>
        <li><span>开奖时间：</span>${escapeHtml(fields["开奖时间"] || "-")}</li>
      </ul>
      <div class="cj-result-winners">${winnerHtml}</div>
      <div class="cj-result-footer">恭喜中奖用户！</div>
    </div>`;

  $elem.html(rawHtml.replace(/\[抽奖结果\][\s\S]*?\[\/抽奖结果\]/, resultHtml));
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
