document.addEventListener('DOMContentLoaded', () => {
  const inboxBtn   = document.getElementById('inbox-btn');
  const badge      = document.getElementById('inbox-badge');
  const container  = document.getElementById('view-container');

  // unread count
  async function refreshBadge() {
    const res = await fetch(`${apiBase}/notifications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      console.warn('refreshBadge not authorized', res.status);
      badge.classList.add('hidden');
      return;
    }
    const notes = await res.json();
    if (!Array.isArray(notes)) {
      console.warn('refreshBadge errror', notes);
      badge.classList.add('hidden');
      return;
    }
    const unread = notes.filter(n => n.is_read === 0).length;
    if (unread) {
      badge.textContent = unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // Show full notifications page
  inboxBtn.addEventListener('click', async () => {
    badge.classList.add('hidden');
    const res   = await fetch(`${apiBase}/notifications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const notes = await res.json();

    container.innerHTML = '<h2>Inbox</h2><div id="notes-list"></div>';
    const list = document.getElementById('notes-list');

    notes.forEach(n => {
      const { id, message, metadata, type, is_read, created_at } = n;
      const hr = document.createElement('hr');
      const div= document.createElement('div');
      div.innerHTML = `
        <p style="${is_read? 'opacity:0.6':'font-weight:bold'}">
          <small>${new Date(created_at).toLocaleString()}</small><br>
          ${message}
        </p>
        <button data-id="${id}" class="mark-read-btn">
          ${is_read ? 'Read' : 'Mark as read'}
        </button>
      `;
      list.appendChild(div);
      list.appendChild(hr);
    });

    // mark as read buttons
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await fetch(`${apiBase}/notifications/${id}/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        // Refresh
        inboxBtn.click();
        // update badge
        refreshBadge();
      });
    });
  });

  // Initial badge load
  refreshBadge();
  setInterval(refreshBadge, 60_000);
});
