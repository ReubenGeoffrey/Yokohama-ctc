import builtinMasterJson from '../data/builtinMaster.json';

export const BUILTIN_MASTER = builtinMasterJson;

export const BUILTIN_MASTER_META = {
  fileName: 'Yokohama_CTC_Master_Embedded.xlsx',
  savedAt: 'Embedded System Master',
  operatorCount: 561,
  contractCount: 1444,
  napsCount: 236,
  isBuiltIn: true
};

export function getEffectiveMaster(customMaster) {
  if (customMaster && (
    (customMaster.operator && Object.keys(customMaster.operator).length > 0) ||
    (customMaster.contract && Object.keys(customMaster.contract).length > 0) ||
    (customMaster.naps && Object.keys(customMaster.naps).length > 0)
  )) {
    return customMaster;
  }
  return BUILTIN_MASTER;
}

export function getEffectiveMasterMeta(customMeta, customMaster) {
  if (customMaster && customMeta && (
    (customMaster.operator && Object.keys(customMaster.operator).length > 0) ||
    (customMaster.contract && Object.keys(customMaster.contract).length > 0) ||
    (customMaster.naps && Object.keys(customMaster.naps).length > 0)
  )) {
    return customMeta;
  }
  return BUILTIN_MASTER_META;
}
