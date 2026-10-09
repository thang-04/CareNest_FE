import { Info, Phone, Mail, MapPin, Building, Home } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_LABELS } from '@/models/User';
import { MANAGER_LABELS, locationLabel } from '@/models/Location';

const UserLine = ({ user }) => (
  <span className="row" style={{ gap: 10 }}>
    <Avatar user={user} size="sm" />
    <span style={{ textAlign: 'left' }}>
      <span className="fw-600" style={{ display: 'block' }}>
        {user.fullName}
      </span>
      <span className="muted text-xs">{ROLE_LABELS[user.role]}</span>
    </span>
  </span>
);

/**
 * Handover / receiver person of a transfer. SRS UC 7.5: it is always the person in charge of the
 * sending / receiving room, so the picker only shows that person (the service enforces the same rule).
 */
export function UserPicker({ title, location, campus, users, locations, campuses, value, error, tone = 'from' }) {
  const responsible = users.find((u) => u.id === location?.managerUserId) || null;
  const selectedUser = users.find((u) => u.id === value) || null;
  const LocIcon = tone === 'from' ? Home : MapPin;

  const managedLocations = selectedUser
    ? locations
        .filter((l) => selectedUser.locationIds?.includes(l.id))
        .map(locationLabel)
        .join(', ') || '—'
    : '';
  const userCampus = selectedUser ? campuses.find((c) => c.id === selectedUser.campusId) : null;

  return (
    <div className="user-picker">
      <div className="subsection-title">
        {title}
        <span className="req">*</span>
      </div>
      <div className={`loc-banner loc-banner--${tone}`}>
        <span className="loc-banner__icon">
          <LocIcon size={20} />
        </span>
        <div>
          <div className="fw-600">{tone === 'from' ? 'Nơi đi' : 'Nơi đến'}</div>
          <div className="text-2">{location ? `${locationLabel(location)} - ${campus?.shortName || ''}` : 'Chưa chọn'}</div>
        </div>
      </div>

      <div className="user-picker__options">
        <div className="row">
          <span className="fw-600">{MANAGER_LABELS[location?.type] || 'Người phụ trách'}</span>
          <span title="Người thực hiện là người phụ trách lớp/phòng này">
            <Info size={15} className="muted" />
          </span>
        </div>
        <div className="user-picker__static">
          {responsible ? (
            <UserLine user={responsible} />
          ) : (
            <span className="text-danger">
              {location ? 'Lớp/phòng chưa có người phụ trách. Cập nhật người phụ trách trước khi luân chuyển.' : 'Chọn lớp/phòng trước'}
            </span>
          )}
        </div>
      </div>

      {selectedUser ? (
        <div className="contact-bar">
          <span>
            <Phone size={15} className="text-primary" /> Số điện thoại: {selectedUser.phone}
          </span>
          <span>
            <Mail size={15} className="text-primary" /> Email: {selectedUser.email}
          </span>
          <span>
            <Building size={15} className="text-primary" /> {ROLE_LABELS[selectedUser.role]} · {userCampus?.shortName}
          </span>
          <span>
            <MapPin size={15} className="text-primary" /> Phụ trách: {managedLocations}
          </span>
        </div>
      ) : (
        <div className="contact-bar contact-bar--empty">Chưa có người thực hiện</div>
      )}
      {error && <div className="field__error mt-8">{error}</div>}
    </div>
  );
}
