import { Link } from 'react-router-dom';
import { ClipboardList, FilePlus2, PackagePlus, FileText } from '@/components/ui/icons';
import { canCreateProposal } from '@/utils/facility/facilityPermissions';

/** Navigation shared by the manager lists of the module (issues, requests, proposals). */
export function ManagerLinks({ user, current }) {
  return (
    <div className="row row--wrap" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
      {current !== 'issues' && (
        <Link className="btn" to="/facility/issues">
          <ClipboardList size={16} /> Báo cáo sự cố
        </Link>
      )}
      {current !== 'requests' && (
        <Link className="btn" to="/facility/requests">
          <PackagePlus size={16} /> Đề nghị bổ sung
        </Link>
      )}
      {current !== 'proposals' && (
        <Link className="btn" to="/facility/proposals">
          <FileText size={16} /> Đề xuất
        </Link>
      )}
      {canCreateProposal(user) && (
        <Link className="btn btn--primary" to="/facility/proposals/new">
          <FilePlus2 size={16} /> Lập đề xuất
        </Link>
      )}
    </div>
  );
}
