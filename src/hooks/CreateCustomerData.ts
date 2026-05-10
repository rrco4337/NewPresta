import { useState, useEffect } from 'react';
import { genderService, type Gender } from '../services/genderApi';
import { customerGroupService, type CustomerGroup } from '../services/CustomergroupApi';


export const useCustomerFormData = () => {
  const [genders, setGenders] = useState<Gender[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [gendersData, groupsData] = await Promise.all([
          genderService.getAll(),
          customerGroupService.getAll()
        ]);
        setGenders(gendersData);
        setGroups(groupsData);
      } catch (err) {
        console.error("Erreur lors du chargement des options du formulaire", err);
      } finally {
        setLoadingOptions(false);
      }
    };
    loadData();
  }, []);

  return { genders, groups, loadingOptions };
};