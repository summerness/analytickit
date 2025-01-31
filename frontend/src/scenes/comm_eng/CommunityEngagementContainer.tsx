import React, { useState, useEffect } from 'react';
import CommunityEngagementTable from './CommunityEngagementTable';
import { fetchAllCommunityEngagements } from './CommunityEngagementService';
import { CommunityEngagement } from './CommunityEngagementModel';
import './CommunityEngagement.scss'; 
import NewCampaignModal from './NewCampaignModal';

const CommunityEngagementContainer: React.FC = () => {
    console.log("Rendering CommunityEngagementContainer");

    const [, setData] = useState<CommunityEngagement[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

    useEffect(() => {
        const fetchData = async (): Promise<void> => {
            try {
                const result = await fetchAllCommunityEngagements();
                setData(result);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleNewCampaignClick = ():void => {
        setIsModalVisible(true);
    };

    const handleModalClose = ():void => {
        setIsModalVisible(false);
    };

    if (loading) {
        return <p>Loading...</p>;
    }
    if (error) {
        return <p>Error: {error}</p>;
    }

    return (
        <div className="community-engagement">
            <div className="header">
                <h1>Community Engagement</h1>
                {console.log("Rendering button")}

                <button onClick={handleNewCampaignClick}>New Campaign</button>
            </div>
            <div className="table-container">
                <CommunityEngagementTable />
            </div>
            {isModalVisible && (
                <NewCampaignModal 
                    onClose={handleModalClose}
                    // other props as needed
                />
            )}
        </div>
    );
};

export default CommunityEngagementContainer;
